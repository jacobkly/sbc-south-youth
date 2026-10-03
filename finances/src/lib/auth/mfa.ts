import type { Factor } from "@supabase/supabase-js";

/**
 * Two-step sign-in: a password, then a 6-digit code from an authenticator
 * app. Owners set it up in the portal. Supabase calls a session that's done
 * both steps "aal2", and won't change the password of someone who uses it
 * until they've entered a code.
 */

/** An authenticator app someone has set up. */
export type MfaDevice = { id: string; name: string; createdAt: string };

/** Finished authenticator app setups, oldest first. */
export function verifiedDevices(factors: readonly Factor[]): MfaDevice[] {
  return factors
    .filter((factor) => factor.factor_type === "totp" && factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      name: factor.friendly_name?.trim() || "Authenticator app",
      createdAt: factor.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Plain words for a Supabase MFA error. `field` is true when the problem is
 * what was typed, so it shows under that field instead of above the form.
 */
export function describeMfaError(
  error: { status?: number; code?: string },
  fallback: string,
): { field: boolean; message: string } {
  if (error.status === 429) return { field: false, message: "Too many attempts. Wait a few minutes, then try again." };
  if (!error.status || error.status >= 500) {
    return { field: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
  switch (error.code) {
    case "mfa_verification_failed":
      return { field: true, message: "That code didn't work. Enter the newest code from your authenticator app." };
    case "mfa_challenge_expired":
      return { field: true, message: "That took too long. Enter the newest code from your authenticator app." };
    case "mfa_factor_name_conflict":
      return { field: true, message: "You already have a device with that name." };
    case "mfa_totp_enroll_not_enabled":
    case "mfa_totp_verify_not_enabled":
      return { field: false, message: "Two-step sign-in isn't turned on yet. Ask the site maintainer to turn it on." };
    case "insufficient_aal":
      return { field: false, message: "Enter a code from one of your devices first, then try again." };
    default:
      return { field: false, message: fallback };
  }
}
