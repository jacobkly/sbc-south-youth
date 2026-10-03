import "server-only";

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

/**
 * True only when Cloudflare says the token is good. Anything else, like an
 * error or no answer in time, is a no, so the forms fail closed.
 */
export async function verifyTurnstile(
  token: string | null,
  { secret, ip, fetcher = fetch }: { secret: string; ip: string | null; fetcher?: Fetch },
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
      console.error(`[forms] Turnstile answered ${response.status}`);
      return false;
    }
    const answer: unknown = await response.json();
    return typeof answer === "object" && answer !== null && "success" in answer && answer.success === true;
  } catch (error) {
    console.error("[forms] Couldn't reach Turnstile", error);
    return false;
  }
}
