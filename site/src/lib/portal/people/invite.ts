import { canUsePortal, hasRole, sortRoles, type AppRole } from "@/lib/portal/roles";
import type { PayeeChoice } from "./schema";

/**
 * The decisions behind inviting someone, kept apart from the database so
 * each case can be tested. RLS and the RPCs still check everything again.
 */

export type ExistingPerson = { id: string; full_name: string; roles: AppRole[]; is_active: boolean };

export type InviteStatus = "pending" | "accepted";

export type InvitePlan =
  /** A first invite: the account gets these roles and the setup email. */
  | { kind: "invite"; roles: AppRole[]; added: AppRole[] }
  /** Their invite is still pending, so it goes again with any new roles added. */
  | { kind: "resend"; roles: AppRole[]; added: AppRole[] }
  /** They already sign in, so they get the new roles and a note about them. */
  | { kind: "access"; roles: AppRole[]; added: AppRole[] }
  /** They already have every role picked. Nothing to change or send. */
  | { kind: "unchanged"; roles: AppRole[]; added: [] }
  | { kind: "refuse"; message: string };

/** What an invite does for this email address, given who already has it. */
export function planInvite(
  existing: ExistingPerson | null,
  inviteStatus: InviteStatus | null,
  picked: AppRole[],
): InvitePlan {
  if (!existing) return { kind: "invite", roles: sortRoles(picked), added: sortRoles(picked) };
  if (!existing.is_active) {
    const message = `${existing.full_name}'s access was removed. Reinstate them from People instead.`;
    return { kind: "refuse", message };
  }

  const added = sortRoles(picked.filter((role) => !hasRole(existing.roles, role)));
  const roles = sortRoles([...existing.roles, ...added]);

  if (inviteStatus === "pending") return { kind: "resend", roles, added };
  if (inviteStatus === null && existing.roles.length === 0) return { kind: "invite", roles, added };
  if (added.length === 0) return { kind: "unchanged", roles: sortRoles(existing.roles), added: [] };
  return { kind: "access", roles, added };
}

export type PayeeRow = { id: string; email: string | null; user_id: string | null };

export type PayeeDecision =
  | { action: "none" }
  | { action: "create" }
  | { action: "link"; payeeId: string }
  | { action: "refuse"; message: string };

/**
 * Which payee a requester's reimbursements go to. Someone already linked
 * keeps their payee. Otherwise a picked payee is linked, and "new" links the
 * payee that already has their email before it makes another, since payee
 * emails are unique.
 */
export function choosePayee(input: {
  choice: PayeeChoice | null;
  /** Their account, when they already have one. */
  userId: string | null;
  /** The payee their account is already linked to. */
  linked: string | null;
  /** The payee that was picked, as it is now. */
  picked: PayeeRow | null;
  /** The payee with their email, if any. */
  sameEmail: PayeeRow | null;
}): PayeeDecision {
  const { choice, userId, linked, picked, sameEmail } = input;
  if (!choice || linked) return { action: "none" };

  const theirs = (payee: PayeeRow) => payee.user_id === null || payee.user_id === userId;

  if (choice.kind === "existing") {
    if (!picked) return { action: "refuse", message: "That payee isn't in finances anymore. Pick another." };
    if (!theirs(picked)) {
      return { action: "refuse", message: "That payee is already linked to someone else. Pick another." };
    }
    return picked.user_id === userId && userId !== null ? { action: "none" } : { action: "link", payeeId: picked.id };
  }

  if (!sameEmail) return { action: "create" };
  if (!theirs(sameEmail)) {
    return {
      action: "refuse",
      message: "Another person's payee already uses this email. Pick their payee instead, or check the email.",
    };
  }
  return { action: "link", payeeId: sameEmail.id };
}

export type AccountLinks = {
  app: "portal" | "finances";
  appName: string;
  setupUrl: string;
  signInUrl: string;
};

/** Where an invite or access email sends someone: requesters only use finances. */
export function accountLinks(
  roles: readonly AppRole[],
  urls: { portalUrl: string; financesUrl: string },
): AccountLinks {
  const portal = canUsePortal({ is_active: true, roles });
  const base = portal ? urls.portalUrl : urls.financesUrl;
  return {
    app: portal ? "portal" : "finances",
    appName: portal ? "SBC South Youth Portal" : "SBC South Youth Finances",
    setupUrl: `${base}/setup`,
    signInUrl: `${base}/login`,
  };
}

/**
 * An `ilike` pattern that matches only this address, ignoring case. `*` is
 * PostgREST's wildcard and can't be escaped, so it matches any one
 * character here, and callers compare the rows they get back exactly.
 */
export function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`).replace(/\*/g, "_");
}

/** Codes the people RPCs raise with messages written to be shown. */
const SHOWN_CODES = new Set(["42501", "22023", "55000", "P0002", "23505"]);

/** Postgres's own wording, which never helps the person reading it. */
const INTERNAL = /row-level security|duplicate key|violates|constraint|relation|column/i;

/** A database error as words for the form, or the fallback. */
export function friendlyError(error: { code?: string; message: string } | null, fallback: string): string {
  if (!error?.code || !SHOWN_CODES.has(error.code) || INTERNAL.test(error.message)) return fallback;
  return error.message;
}
