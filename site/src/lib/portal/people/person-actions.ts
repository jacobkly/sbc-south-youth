"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { readPortalEnv } from "@/lib/env";
import { banUser, unbanUser } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { accountLinks, choosePayee, emailPattern, emailProblem, friendlyError, type PayeeRow } from "./invite";
import { planRoles } from "./person";
import { loadPerson, type PersonDetails } from "./queries";
import { emailInvite, linkPayee, requireOwner, type Supabase } from "./server";

export type PersonResult =
  | { status: "failed"; message: string }
  | {
      status: "done";
      message: string;
      /** Something that didn't work after the change itself was saved. */
      warning: string | null;
      /** The owner took Owner away from themselves, so this page isn't theirs anymore. */
      leftOwner?: boolean;
    };

const GONE = "That person isn't here anymore. Go back to People and try again.";

function failed(message: string): PersonResult {
  return { status: "failed", message };
}

function done(message: string, warning: string | null = null): PersonResult {
  return { status: "done", message, warning };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The person as the owner sees them now, or why not. */
async function current(userId: unknown) {
  if (typeof userId !== "string" || !z.uuid().safeParse(userId).success) return null;
  return loadPerson(userId.toLowerCase());
}

/**
 * Saves the roles an owner ticked on someone's page. A new requester gets
 * the payee with their email, or a new one. Someone who already signs in
 * gets an email about any new roles; a pending invite carries them instead.
 */
export async function saveRoles(userId: string, roles: string[]): Promise<PersonResult> {
  const owner = await requireOwner("Only an owner can change roles.");
  if ("refused" in owner) return failed(owner.refused);
  const { me } = owner;

  const person = await current(userId);
  if (!person) return failed(GONE);
  const plan = planRoles({
    person: { id: person.id, roles: person.roles, isActive: person.isActive, invite: person.invite?.status ?? null },
    meId: me.id,
    activeOwners: person.activeOwners,
    picked: roles,
  });
  if (plan.kind === "invalid") return failed(plan.message);
  if (plan.kind === "unchanged") return done("Nothing changed.");

  const fallback = "Couldn't save their roles. Check your connection and try again.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_roles", { p_user_id: person.id, p_roles: plan.roles });
  if (error) return failed(friendlyError(error, fallback));

  const warnings: string[] = [];
  if (plan.added.includes("finance_requester") && !person.payee) {
    const warning = await linkTheirPayee(supabase, person);
    if (warning) warnings.push(warning);
  }

  // A pending invite already lists every role, and a resend carries new ones.
  if (plan.added.length > 0 && person.invite?.status !== "pending") {
    const sent = await emailInvite({
      kind: "access",
      name: person.name,
      email: person.email,
      inviterName: me.full_name,
      roles: plan.added,
      links: accountLinks(plan.roles, readPortalEnv()),
      related: { type: "user", id: person.id },
    });
    const problem = emailProblem(sent, "access");
    if (problem) warnings.push(`The email about their new access didn't go out. ${problem}`);
  }

  const you = person.id === me.id;
  const name = firstName(person.name);
  const message =
    plan.owner === "grant"
      ? `${name} is an owner now. They'll set up two-step sign-in the next time they open the portal.`
      : plan.owner === "revoke"
        ? you
          ? "You're not an owner anymore."
          : `${name} isn't an owner anymore.`
        : you
          ? "Saved your roles."
          : `Saved ${name}'s roles.`;
  const warning = warnings.join(" ") || null;
  // Giving up Owner closes People to them, so the page moves on instead of refreshing into a 404.
  if (you && plan.owner === "revoke") return { status: "done", message, warning, leftOwner: true };
  refresh();
  return done(message, warning);
}

/** Links the payee with their email, or makes one, like "New payee" on the invite form. */
async function linkTheirPayee(supabase: Supabase, person: PersonDetails): Promise<string | null> {
  const { data, error } = await supabase
    .from("payees")
    .select("id, email, user_id")
    .ilike("email", emailPattern(person.email));
  if (error) return "Couldn't link their payee. Link it from finances.";
  const email = person.email.toLowerCase();
  const sameEmail: PayeeRow | null = data.find((row) => row.email?.toLowerCase() === email) ?? null;
  const payee = choosePayee({ choice: { kind: "new" }, userId: person.id, linked: null, picked: null, sameEmail });
  if (payee.action === "refuse") return payee.message;
  if (payee.action === "none") return null;
  return linkPayee(supabase, payee, person.id, person.name, person.email);
}

/** Sends a pending invite again, with the roles they have now. */
export async function resendInvite(userId: string): Promise<PersonResult> {
  const owner = await requireOwner("Only an owner can send invites.");
  if ("refused" in owner) return failed(owner.refused);

  const person = await current(userId);
  if (!person) return failed(GONE);
  if (person.invite?.status !== "pending") {
    return failed("They've already set up their account, so there's no invite to resend.");
  }

  const supabase = await createClient();
  const { data: invite, error } = await supabase.rpc("record_invite", { p_user_id: person.id });
  if (error) return failed(friendlyError(error, "Couldn't send the invite. Check your connection and try again."));

  const sent = await emailInvite({
    kind: "invite",
    name: person.name,
    email: person.email,
    inviterName: owner.me.full_name,
    roles: person.roles,
    links: accountLinks(person.roles, readPortalEnv()),
    related: { type: "invite", id: invite.id },
  });
  refresh();
  const problem = emailProblem(sent, "invite");
  if (problem) return done("Their invite was saved, but the email didn't go out.", problem);
  return done(`Sent the invite to ${person.email} again.`);
}

/**
 * Takes away all of someone's access, keeping their roles for reinstating.
 * The database refuses your own access. Then the ban stops their sign-in
 * from being refreshed; if that fails, trying again only repeats the ban.
 */
export async function removeAccess(userId: string): Promise<PersonResult> {
  const owner = await requireOwner("Only an owner can remove access.");
  if ("refused" in owner) return failed(owner.refused);

  // Read as the owner first, so the secret key only ever touches someone they manage.
  const person = await current(userId);
  if (!person) return failed(GONE);

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_access", { p_user_id: person.id });
  if (error) return failed(friendlyError(error, "Couldn't remove their access. Check your connection and try again."));

  try {
    await banUser(person.id);
  } catch (banError) {
    console.error("[people] Couldn't ban the removed account", banError);
    // No refresh: the dialog stays open, and trying again only repeats the ban.
    return failed(
      "Their access is removed, but they may stay signed in for up to an hour. Try again to sign them out now.",
    );
  }
  refresh();
  return done(`Removed ${firstName(person.name)}'s access.`);
}

/** Gives someone back the access they had: unbans them, then turns their roles back on. */
export async function reinstatePerson(userId: string): Promise<PersonResult> {
  const owner = await requireOwner("Only an owner can reinstate people.");
  if ("refused" in owner) return failed(owner.refused);

  // Read as the owner first, so the secret key only ever touches someone they manage.
  const person = await current(userId);
  if (!person) return failed(GONE);
  if (person.isActive) return done(`${firstName(person.name)} already has access.`);

  const fallback = "Couldn't reinstate them. Check your connection and try again.";
  try {
    await unbanUser(person.id);
  } catch (unbanError) {
    console.error("[people] Couldn't unban the reinstated account", unbanError);
    return failed(fallback);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reinstate", { p_user_id: person.id });
  if (error) return failed(friendlyError(error, fallback));

  refresh();
  return done(`${firstName(person.name)} has their access back.`);
}
