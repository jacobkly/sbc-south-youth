import "server-only";
import { reportError } from "@/lib/errors/report";

/**
 * Cloudflare Turnstile, the check that a form came from a person. The
 * widget on the page gives the form a token, and the server trades it here
 * for a yes or no. Tokens last 5 minutes and work once.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's tokens are never longer than this. */
const MAX_TOKEN_LENGTH = 2048;

/** No form waits longer than this on Cloudflare. */
const TIMEOUT_MS = 8000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Codes for a sender's own token, like one that expired. Any other refusal is ours to fix. */
const TOKEN_CODES = new Set(["missing-input-response", "invalid-input-response", "timeout-or-duplicate"]);

function refusalCodes(answer: unknown): string[] {
  if (typeof answer !== "object" || answer === null || !("error-codes" in answer)) return [];
  const codes = answer["error-codes"];
  return Array.isArray(codes) ? codes.filter((code): code is string => typeof code === "string") : [];
}

/**
 * True only when Cloudflare says the token is good. Anything else, like an
 * error or no answer in time, is a no, so the forms fail closed. When the
 * fault is ours, like Cloudflare being down or refusing the secret, it
 * goes to the owners' error log, since every form fails until it's fixed.
 */
export async function verifyTurnstile(
  token: string | null,
  {
    secret,
    ip,
    fetcher = fetch,
    report = (error) => reportError("Turnstile", error),
  }: { secret: string; ip: string | null; fetcher?: Fetch; report?: (error: unknown) => void },
): Promise<boolean> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetcher(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      report(new Error(`Turnstile answered ${response.status}`));
      return false;
    }
    const answer: unknown = await response.json();
    if (typeof answer === "object" && answer !== null && "success" in answer && answer.success === true) return true;
    const ours = refusalCodes(answer).filter((code) => !TOKEN_CODES.has(code));
    if (ours.length > 0) report(new Error(`Turnstile refused the check: ${ours.join(", ")}`));
    return false;
  } catch (error) {
    report(error);
    return false;
  }
}
