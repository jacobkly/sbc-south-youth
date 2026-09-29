/**
 * Cheap checks that catch most spam bots before Turnstile does. A form
 * that fails one gets a fake success, so the bot learns nothing.
 */

/** A field people never see but bots fill in. Not "company", which browsers autofill. */
export const HONEYPOT_FIELD = "website";

/** How long the form was open before it was sent, in ms. The page's script adds it. */
export const ELAPSED_FIELD = "elapsedMs";

/** Faster than this, it wasn't a person typing. */
export const MIN_FILL_MS = 3000;

/** True when the honeypot is filled in, or the form came back too fast or without the page's script. */
export function looksAutomated(data: FormData): boolean {
  const honeypot = data.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot !== "") return true;
  const elapsed = Number(data.get(ELAPSED_FIELD) || Number.NaN);
  return !(elapsed >= MIN_FILL_MS);
}
