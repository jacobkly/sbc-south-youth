import type { Tables } from "@/lib/database.types";
import { ROLE_LABELS, sortRoles, type AppRole } from "@/lib/portal/roles";
import { lastSeenLabel, relativeDay } from "./person";

export type PeopleUser = Pick<
  Tables<"users">,
  "id" | "full_name" | "email" | "avatar_path" | "roles" | "is_active" | "last_seen_at"
>;
export type PeopleInvite = { user_id: string; status: string; last_sent_at: string };

/**
 * Where someone stands: `invited` until they first sign in, `removed`
 * once an owner takes their access away (their roles are kept), and
 * `no_access` for an account with no roles at all.
 */
export type PersonStatus = "active" | "invited" | "removed" | "no_access";

export type Person = {
  id: string;
  name: string;
  email: string;
  avatarPath: string | null;
  /** The roles to show. An owner is just Owner, since that covers the rest. */
  roles: AppRole[];
  status: PersonStatus;
  /** When they were last seen, or when their pending invite went out. */
  seen: string;
  you: boolean;
};

export const STATUS_LABELS: Record<PersonStatus, string> = {
  active: "Active",
  invited: "Invited",
  removed: "Removed",
  no_access: "No access",
};

/** How each status badge looks. Active people don't get one. */
export const STATUS_VARIANTS: Record<Exclude<PersonStatus, "active">, "outline" | "destructive"> = {
  invited: "outline",
  removed: "destructive",
  no_access: "outline",
};

/** The one badge someone gets in People: removed wins, then a pending invite, then having no roles. */
export function personStatus(
  isActive: boolean,
  roles: readonly AppRole[],
  inviteStatus: string | null | undefined,
): PersonStatus {
  if (!isActive) return "removed";
  if (inviteStatus === "pending") return "invited";
  return roles.length === 0 ? "no_access" : "active";
}

/** Everyone with an account, by name, with removed people at the end. */
export function listPeople(
  users: readonly PeopleUser[],
  invites: readonly PeopleInvite[],
  meId: string,
  now: Date,
): Person[] {
  const inviteFor = new Map(invites.map((invite) => [invite.user_id, invite]));
  return users
    .map((user) => {
      const invite = inviteFor.get(user.id);
      const status = personStatus(user.is_active, user.roles, invite?.status);
      return {
        id: user.id,
        name: user.full_name.trim() || user.email,
        email: user.email,
        avatarPath: user.avatar_path,
        roles: user.roles.includes("owner") ? (["owner"] as AppRole[]) : sortRoles(user.roles),
        status,
        seen:
          status === "invited" && invite
            ? `Invite sent ${relativeDay(invite.last_sent_at, now)}`
            : lastSeenLabel(user.last_seen_at, now),
        you: user.id === meId,
      };
    })
    .sort(
      (a, b) =>
        Number(a.status === "removed") - Number(b.status === "removed") ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}

/** Lowercase without accents, so "zoe" finds "Zoë". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** The people matching every word of a search, by name, email, role, or status. */
export function searchPeople(people: readonly Person[], query: string): Person[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...people];
  return people.filter((person) => {
    const roles = person.roles.map((role) => ROLE_LABELS[role]);
    const text = fold([person.name, person.email, STATUS_LABELS[person.status], ...roles].join(" "));
    return words.every((word) => text.includes(word));
  });
}
