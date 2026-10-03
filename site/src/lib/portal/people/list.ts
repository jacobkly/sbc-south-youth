import type { Tables } from "@/lib/database.types";
import { sortRoles, type AppRole } from "@/lib/portal/roles";

export type PeopleUser = Pick<Tables<"users">, "id" | "full_name" | "email" | "avatar_path" | "roles" | "is_active">;
export type PeopleInvite = { user_id: string; status: string };

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
  you: boolean;
};

function statusOf(user: PeopleUser, invite: PeopleInvite | undefined): PersonStatus {
  if (!user.is_active) return "removed";
  if (invite?.status === "pending") return "invited";
  return user.roles.length === 0 ? "no_access" : "active";
}

/** Everyone with an account, by name, with removed people at the end. */
export function listPeople(users: readonly PeopleUser[], invites: readonly PeopleInvite[], meId: string): Person[] {
  const inviteFor = new Map(invites.map((invite) => [invite.user_id, invite]));
  return users
    .map((user) => ({
      id: user.id,
      name: user.full_name.trim() || user.email,
      email: user.email,
      avatarPath: user.avatar_path,
      roles: user.roles.includes("owner") ? (["owner"] as AppRole[]) : sortRoles(user.roles),
      status: statusOf(user, inviteFor.get(user.id)),
      you: user.id === meId,
    }))
    .sort(
      (a, b) =>
        Number(a.status === "removed") - Number(b.status === "removed") ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}
