import { daysBetween, laDateOf } from "@/lib/dates";
import { APP_ROLES, sortRoles, type AppRole } from "@/lib/portal/roles";
import type { InviteStatus } from "./invite";

/**
 * The decisions behind a person's page, kept apart from the database so
 * each case can be tested. RLS, the RPCs, and keep_an_owner() still check
 * everything again.
 */

const HOUR = 60 * 60 * 1000;

const sameYear = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
const otherYear = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** A day in words from Los Angeles: "today", "yesterday", "3 days ago", "Sep 25", or "Dec 30, 2025". */
export function relativeDay(iso: string, now: Date): string {
  const then = new Date(iso);
  const days = Math.max(0, daysBetween(laDateOf(then), laDateOf(now)));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return (laDateOf(then).slice(0, 4) === laDateOf(now).slice(0, 4) ? sameYear : otherYear).format(then);
}

/** When someone last opened the portal or finances. A visit is recorded at most once an hour. */
export function lastSeenLabel(lastSeenAt: string | null, now: Date): string {
  if (!lastSeenAt) return "Hasn't signed in yet";
  if (now.getTime() - new Date(lastSeenAt).getTime() < HOUR) return "Seen in the last hour";
  return `Seen ${relativeDay(lastSeenAt, now)}`;
}

export type PersonInvite = {
  status: InviteStatus;
  sentCount: number;
  lastSentAt: string;
  acceptedAt: string | null;
};

/** Where someone's invite stands: "Sent 2 times, last today, not accepted yet", or "Accepted Sep 2". */
export function inviteLabel(invite: PersonInvite, now: Date): string {
  if (invite.status === "accepted") {
    return invite.acceptedAt ? `Accepted ${relativeDay(invite.acceptedAt, now)}` : "Accepted";
  }
  const sent = relativeDay(invite.lastSentAt, now);
  return invite.sentCount > 1
    ? `Sent ${invite.sentCount} times, last ${sent}, not accepted yet`
    : `Sent ${sent}, not accepted yet`;
}

export type PersonState = {
  id: string;
  roles: AppRole[];
  isActive: boolean;
  invite: InviteStatus | null;
};

/** What an owner can do from someone's page. */
export type PersonControls = {
  you: boolean;
  /** Their roles can change. Not while their access is removed. */
  editRoles: boolean;
  /** Why the Owner box can't change, when it can't. */
  ownerLock: string | null;
  /** Their invite is still pending, so it can go again. */
  resend: boolean;
  /** Nobody removes their own access, so there's always an owner left. */
  remove: boolean;
  reinstate: boolean;
};

const MESSAGES = {
  noRoles: "Choose at least one role. To take away all their access, use Remove access.",
  removed: "Reinstate them before changing their roles.",
  notSetUp: "They can be made an owner once they've set up their account.",
  lastOwner: "You're the only owner. Make someone else an owner before you give it up.",
  theLastOwner: "They're the only owner. Make someone else an owner before taking it away.",
};

export function personControls(person: PersonState, meId: string, activeOwners: number): PersonControls {
  const you = person.id === meId;
  const owner = person.roles.includes("owner");
  let ownerLock: string | null = null;
  if (person.isActive && owner && activeOwners <= 1) ownerLock = you ? MESSAGES.lastOwner : MESSAGES.theLastOwner;
  else if (person.isActive && !owner && person.invite === "pending") ownerLock = MESSAGES.notSetUp;

  return {
    you,
    editRoles: person.isActive,
    ownerLock,
    resend: person.isActive && person.invite === "pending",
    remove: person.isActive && !you,
    reinstate: !person.isActive,
  };
}

export type RolesPlan =
  | { kind: "invalid"; message: string }
  | { kind: "unchanged" }
  | {
      kind: "change";
      roles: AppRole[];
      added: AppRole[];
      removed: AppRole[];
      /** Whether Owner is being given or taken away, which the owner confirms first. */
      owner: "grant" | "revoke" | null;
    };

/**
 * What saving the role boxes on someone's page does. Taking Owner away
 * keeps the roles they had under it, so they fall back to those.
 */
export function planRoles(input: {
  person: PersonState;
  meId: string;
  activeOwners: number;
  picked: unknown;
}): RolesPlan {
  const { person, meId, activeOwners, picked } = input;
  const controls = personControls(person, meId, activeOwners);
  if (!controls.editRoles) return { kind: "invalid", message: MESSAGES.removed };

  const known = (role: unknown): role is AppRole => (APP_ROLES as readonly unknown[]).includes(role);
  if (!Array.isArray(picked) || !picked.every(known)) return { kind: "invalid", message: MESSAGES.noRoles };
  const roles = sortRoles(picked);
  if (roles.length === 0) return { kind: "invalid", message: MESSAGES.noRoles };

  const current = sortRoles(person.roles);
  const added = roles.filter((role) => !current.includes(role));
  const removed = current.filter((role) => !roles.includes(role));
  if (added.length === 0 && removed.length === 0) return { kind: "unchanged" };

  const owner = added.includes("owner") ? "grant" : removed.includes("owner") ? "revoke" : null;
  if (owner && controls.ownerLock) return { kind: "invalid", message: controls.ownerLock };
  return { kind: "change", roles, added, removed, owner };
}
