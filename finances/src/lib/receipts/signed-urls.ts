import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { RECEIPTS_BUCKET } from "./upload";

/** Receipt links last five minutes, so a copied link stops working soon after. */
export const SIGNED_URL_SECONDS = 300;

/** Links are re-signed a minute early, which also covers a phone clock that's slightly off. */
const RESIGN_AFTER_MS = (SIGNED_URL_SECONDS - 60) * 1000;

export type SignedReceiptUrls = {
  /** Signed URL by storage path. A path is missing when its file couldn't be signed. */
  urls: Record<string, string>;
  /** When the links were requested, in milliseconds. They expire a little after this. */
  signedAt: number;
};

/** Whether links signed at `signedAt` should be re-signed before they're used. */
export function isSignedUrlStale(signedAt: number, now: number = Date.now()): boolean {
  return now - signedAt >= RESIGN_AFTER_MS;
}

/**
 * Whether links were signed in the last few seconds. A link that fails to load
 * right after signing is missing or blocked, and signing again won't help.
 */
export function isJustSigned(signedAt: number, now: number = Date.now()): boolean {
  return now - signedAt < 10_000;
}

/**
 * Signs short-lived links for receipt files. The bucket is private, so this
 * is the only way to show one, and storage checks that the user can read the
 * request first. Returns null when the links couldn't be made.
 */
export async function signReceiptUrls(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<SignedReceiptUrls | null> {
  // Taken before the request, so the links never outlive what the app expects.
  const signedAt = Date.now();
  if (paths.length === 0) return { urls: {}, signedAt };

  try {
    const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) return null;
    const urls: Record<string, string> = {};
    for (const item of data) if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
    return { urls, signedAt };
  } catch {
    // A dropped connection throws instead of returning an error.
    return null;
  }
}
