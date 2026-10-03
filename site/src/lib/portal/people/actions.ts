"use server";

import { refresh } from "next/cache";
import { EMAIL_PRIORITY, sendEmail, type SendResult } from "@/lib/email/send";
import { assertWritable, readPortalEnv, ReadOnlyError } from "@/lib/env";
import { getCurrentUser, getSessionAal } from "@/lib/portal/auth/current-user";
import { createInvitedUser } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  accountLinks,
  choosePayee,
  emailPattern,
  friendlyError,
  planInvite,
  type InviteStatus,
  type PayeeRow,
} from "./invite";
import { inviteEmail } from "./invite-email";
import { checkInvite, type InviteErrors } from "./schema";

export type InviteValues = {
  fullName: string;
  email: string;
  roles: string[];
  adult: boolean;
  /** "new", or the ID of an existing payee. Only read for requesters. */
  payee: string;
};

export type InviteResult =
  | { status: "invalid"; errors: InviteErrors }
  | { status: "failed"; message: string }
  | {
      status: "done";
      /** What happened: a first invite, a resend, new access, or nothing new. */
      kind: "invite" | "resend" | "access" | "unchanged";
      name: string;
      email: string;
      app: "portal" | "finances";
      /** Whether the email went out. `off` when email isn't set up here. */
      sent: SendResult["status"] | null;
      /** Something that didn't work after the invite itself was saved. */
      warning: string | null;
    };

const FALLBACK = "Couldn't send the invite. Check your connection and try again.";

function failed(message: string): InviteResult {
  return { status: "failed", message };
}

/**
 * Invites someone with the roles an owner picked, or gives someone who
 * already has an account those roles too. Only the account itself is made
 * with the secret key. Everything after runs as the owner, so RLS and the
 * RPCs check it all again.
 */
export async function invitePerson(values: InviteValues): Promise<InviteResult> {
  const check = checkInvite(values);
  if (!check.ok) return { status: "invalid", errors: check.errors };
  const { invite } = check;

  // The secret key below can't check who's asking, so this has to.
  const me = await getCurrentUser();
  if (!me?.is_active || !me.roles.includes("owner")) return failed("Only an owner can invite people.");
  if ((await getSessionAal()) !== "aal2") {
    return failed("Enter a code from your authenticator app first. Reload the page to get asked for one.");
  }

  try {
    assertWritable();
  } catch (error) {
    if (error instanceof ReadOnlyError) return failed(error.message);
    throw error;
  }

  const supabase = await createClient();

  // Who already has this address, and where their invite and payee stand.
  const { data: matches, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email, roles, is_active")
    .ilike("email", emailPattern(invite.email));
  if (userError) return failed(friendlyError(userError, FALLBACK));
  const existing = matches.find((user) => user.email.toLowerCase() === invite.email) ?? null;

  let inviteStatus: InviteStatus | null = null;
  let linked: string | null = null;
  if (existing) {
    const [invites, payees] = await Promise.all([
      supabase.from("invites").select("status").eq("user_id", existing.id).maybeSingle(),
      supabase.from("payees").select("id").eq("user_id", existing.id).maybeSingle(),
    ]);
    if (invites.error || payees.error) return failed(friendlyError(invites.error ?? payees.error, FALLBACK));
    inviteStatus = (invites.data?.status as InviteStatus | undefined) ?? null;
    linked = payees.data?.id ?? null;
  }

  const plan = planInvite(existing, inviteStatus, invite.roles);
  if (plan.kind === "refuse") return failed(plan.message);

  // Settle the payee before changing anything, so a refusal leaves no half-done invite.
  let picked: PayeeRow | null = null;
  let sameEmail: PayeeRow | null = null;
  if (invite.payee?.kind === "existing" && !linked) {
    const { data, error } = await supabase
      .from("payees")
      .select("id, email, user_id")
      .eq("id", invite.payee.id)
      .maybeSingle();
    if (error) return failed(friendlyError(error, FALLBACK));
    picked = data;
  } else if (invite.payee?.kind === "new" && !linked) {
    const { data, error } = await supabase
      .from("payees")
      .select("id, email, user_id")
      .ilike("email", emailPattern(invite.email));
    if (error) return failed(friendlyError(error, FALLBACK));
    sameEmail = data.find((payee) => payee.email?.toLowerCase() === invite.email) ?? null;
  }
  const payee = choosePayee({ choice: invite.payee, userId: existing?.id ?? null, linked, picked, sameEmail });
  if (payee.action === "refuse") return failed(payee.message);

  const name = existing?.full_name ?? invite.fullName;
  const links = accountLinks(plan.roles, readPortalEnv());
  const done = (sent: SendResult["status"] | null, warning: string | null = null): InviteResult => ({
    status: "done",
    kind: plan.kind,
    name,
    email: invite.email,
    app: links.app,
    sent,
    warning,
  });

  let userId = existing?.id;
  if (!userId) {
    try {
      userId = (await createInvitedUser({ email: invite.email, fullName: invite.fullName })).id;
    } catch (error) {
      console.error("[people] Couldn't create the invited account", error);
      return failed("Couldn't create their account. Try again in a minute.");
    }
  }

  if (plan.kind !== "unchanged") {
    const { error } = await supabase.rpc("set_roles", { p_user_id: userId, p_roles: plan.roles });
    if (error) return failed(friendlyError(error, FALLBACK));
  }

  let inviteId: string | null = null;
  if (plan.kind === "invite" || plan.kind === "resend") {
    const { data, error } = await supabase.rpc("record_invite", { p_user_id: userId });
    if (error) return failed(friendlyError(error, FALLBACK));
    inviteId = data.id;
  }

  let warning: string | null = null;
  if (payee.action === "create" || payee.action === "link") {
    warning = await linkPayee(supabase, payee, userId, invite.fullName, invite.email);
  }

  refresh();
  if (plan.kind === "unchanged") return done(null, warning);

  const message = inviteEmail({
    kind: plan.kind === "access" ? "access" : "invite",
    fullName: name,
    email: invite.email,
    inviterName: me.full_name,
    roles: plan.kind === "access" ? plan.added : plan.roles,
    links,
  });
  const result = await sendEmail({
    template: plan.kind === "access" ? "access" : "invite",
    priority: EMAIL_PRIORITY.invite,
    to: invite.email,
    subject: message.subject,
    scope: "platform",
    related: inviteId ? { type: "invite", id: inviteId } : { type: "user", id: userId },
    body: message.body,
  });
  return done(result.status, warning);
}

/** Makes or links the requester's payee. Returns a warning instead of failing the saved invite. */
async function linkPayee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payee: { action: "create" } | { action: "link"; payeeId: string },
  userId: string,
  fullName: string,
  email: string,
): Promise<string | null> {
  const fallback = "Couldn't link their payee. Link it from finances.";
  let payeeId = payee.action === "link" ? payee.payeeId : null;
  if (!payeeId) {
    const { data, error } = await supabase
      .from("payees")
      .insert({ full_name: fullName, email })
      .select("id")
      .single();
    if (error) return friendlyError(error, fallback);
    payeeId = data.id;
  }
  const { error } = await supabase.rpc("link_payee", { p_payee_id: payeeId, p_user_id: userId });
  return error ? friendlyError(error, fallback) : null;
}
