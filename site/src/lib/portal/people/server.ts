import "server-only";
import { EMAIL_PRIORITY, sendEmail, type SendResult } from "@/lib/email/send";
import { assertWritable, ReadOnlyError } from "@/lib/env";
import { getCurrentUser, getSessionAal, type PortalUser } from "@/lib/portal/auth/current-user";
import type { AppRole } from "@/lib/portal/roles";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type AccountLinks } from "./invite";
import { inviteEmail } from "./invite-email";

/**
 * What the people actions share. These aren't actions themselves, so they
 * live outside the "use server" files, where every export could be called.
 */

export type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The signed-in owner, or why they can't manage people right now. The
 * secret key can't check who's asking, so every people action calls this
 * first: an active owner, past two-step sign-in, and not on staging.
 */
export async function requireOwner(refusal: string): Promise<{ me: PortalUser } | { refused: string }> {
  const me = await getCurrentUser();
  if (!me?.is_active || !me.roles.includes("owner")) return { refused: refusal };
  if ((await getSessionAal()) !== "aal2") {
    return { refused: "Enter a code from your authenticator app first. Reload the page to get asked for one." };
  }
  try {
    assertWritable();
  } catch (error) {
    if (error instanceof ReadOnlyError) return { refused: error.message };
    throw error;
  }
  return { me };
}

/** Makes or links the requester's payee. Returns a warning instead of failing what was already saved. */
export async function linkPayee(
  supabase: Supabase,
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

/** Sends an invite, or a note about new access, logged against the invite or the person. */
export async function emailInvite(input: {
  kind: "invite" | "access";
  name: string;
  email: string;
  inviterName: string;
  /** Every role for an invite, and only the new ones for access. */
  roles: AppRole[];
  links: AccountLinks;
  related: { type: "invite" | "user"; id: string };
}): Promise<SendResult["status"]> {
  const message = inviteEmail({
    kind: input.kind,
    fullName: input.name,
    email: input.email,
    inviterName: input.inviterName,
    roles: input.roles,
    links: input.links,
  });
  const result = await sendEmail({
    template: input.kind,
    priority: EMAIL_PRIORITY.invite,
    to: input.email,
    subject: message.subject,
    scope: "platform",
    related: input.related,
    body: message.body,
  });
  return result.status;
}
