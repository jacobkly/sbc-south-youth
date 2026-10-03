import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { AppRole } from "@/lib/portal/roles";
import { createClient } from "@/lib/supabase/server";
import type { InviteStatus } from "./invite";
import { listPeople, type Person } from "./list";
import type { PersonInvite } from "./person";

/**
 * What the People screens read, as the signed-in owner. RLS decides what
 * comes back: everyone else gets only their own row, or nothing.
 */

/** Everyone with an account, for the People list. */
export async function loadPeople(meId: string, now: Date): Promise<Person[]> {
  const supabase = await createClient();
  const [users, invites] = await Promise.all([
    supabase.from("users").select("id, full_name, email, avatar_path, roles, is_active, last_seen_at"),
    supabase.from("invites").select("user_id, status, last_sent_at"),
  ]);
  if (users.error) throw users.error;
  if (invites.error) throw invites.error;
  return listPeople(users.data, invites.data, meId, now);
}

export type PersonDetails = {
  id: string;
  /** Their name, or their email when the name is blank. */
  name: string;
  email: string;
  avatarPath: string | null;
  roles: AppRole[];
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  invite: PersonInvite | null;
  /** The finances payee their reimbursements go to. */
  payee: { id: string; name: string } | null;
  /** Active owners, so the last one can't give it up. */
  activeOwners: number;
};

/**
 * One person, with their invite, payee, and how many owners there are.
 * Null when the ID isn't one, or RLS hides them. Loaded once per request,
 * so the page title and the page share it.
 */
export const loadPerson = cache(async (id: string): Promise<PersonDetails | null> => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const [user, invite, payee, owners] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, avatar_path, roles, is_active, last_seen_at, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("invites")
      .select("status, sent_count, last_sent_at, accepted_at")
      .eq("user_id", id)
      .maybeSingle(),
    supabase.from("payees").select("id, full_name").eq("user_id", id).maybeSingle(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["owner"])
      .eq("is_active", true),
  ]);
  if (user.error) throw user.error;
  if (invite.error) throw invite.error;
  if (payee.error) throw payee.error;
  if (owners.error) throw owners.error;
  if (!user.data) return null;

  const row = user.data;
  return {
    id: row.id,
    name: row.full_name.trim() || row.email,
    email: row.email,
    avatarPath: row.avatar_path,
    roles: row.roles,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    invite: invite.data && {
      status: invite.data.status as InviteStatus,
      sentCount: invite.data.sent_count,
      lastSentAt: invite.data.last_sent_at,
      acceptedAt: invite.data.accepted_at,
    },
    payee: payee.data && { id: payee.data.id, name: payee.data.full_name },
    activeOwners: owners.count ?? 0,
  };
});
