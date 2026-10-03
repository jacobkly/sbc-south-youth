import type { AuthenticatorAssuranceLevels, Factor } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/portal/roles";

/**
 * Two-step sign-in: a password, then a 6-digit code from an authenticator
 * app. Owners must use it, since they can change who has access and pay
 * reimbursements. Supabase calls a session that's done both steps "aal2".
 * The shell only asks; the database requires aal2 for owner actions later.
 */

export type AssuranceLevel = AuthenticatorAssuranceLevels | null | undefined;

/** An authenticator app someone has set up, as the portal shows it. */
export type MfaDevice = { id: string; name: string; createdAt: string };

const MAX_NAME_LENGTH = 40;

/** Whether an owner still has to enter a code before using the portal. Nobody else is asked. */
export function ownerNeedsMfa(roles: readonly AppRole[], aal: AssuranceLevel): boolean {
  return roles.includes("owner") && aal !== "aal2";
}

/** The code step's URL, keeping where to go after. */
export function mfaHref(next: string): string {
  return next === "/" ? "/mfa" : `/mfa?next=${encodeURIComponent(next)}`;
}

/**
 * Where to go once the password is right. Anyone with a device enters a
 * code next, so the link they followed survives the extra step.
 */
export function afterSignInPath(
  next: string,
  level: { currentLevel: AssuranceLevel; nextLevel: AssuranceLevel } | null,
): string {
  return level?.nextLevel === "aal2" && level.currentLevel !== "aal2" ? mfaHref(next) : next;
}

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

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A name for the next device: Phone, then Backup, then numbered. */
export function suggestDeviceName(existing: readonly string[]): string {
  const taken = (name: string) => existing.some((other) => sameName(other, name));
  for (const name of ["Phone", "Backup"]) {
    if (!taken(name)) return name;
  }
  let number = 3;
  while (taken(`Device ${number}`)) number += 1;
  return `Device ${number}`;
}

/** What's wrong with a new device's name, if anything. Supabase needs each name to be different. */
export function deviceNameError(name: string, existing: readonly string[]): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Name this device.";
  if (trimmed.length > MAX_NAME_LENGTH) return `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  const match = existing.find((other) => sameName(other, trimmed));
  if (match) return `You already have a device called ${match}.`;
  return undefined;
}

/** The setup key in groups of four, so it's easier to type into an app. */
export function groupKey(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

const SVG_URL = /^data:image\/svg\+xml;(?:charset=)?utf-8,/;

/**
 * Supabase's QR code as an image URL. It sends an SVG data URL with the
 * markup left raw, where a "#" would end the URL early, so the markup is
 * encoded again. A bare SVG gets the same treatment.
 */
export function qrCodeSrc(qrCode: string): string {
  if (qrCode.startsWith("data:") && !SVG_URL.test(qrCode)) return qrCode;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode.replace(SVG_URL, ""))}`;
}

const deviceDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Los_Angeles",
});

/** The day a device was added, like "Oct 1, 2026". */
export function formatDeviceDate(iso: string): string {
  return deviceDate.format(new Date(iso));
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
