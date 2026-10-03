import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_URL, verifyTurnstile } from "./turnstile";

type Call = { url: string; body: URLSearchParams };

/** Cloudflare's siteverify, answering every call the same way. */
function cloudflare(answer: { status?: number; body?: unknown } | Error) {
  const calls: Call[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(init.body as string) });
    if (answer instanceof Error) throw answer;
    return Response.json(answer.body ?? {}, { status: answer.status ?? 200 });
  };
  return { fetcher, calls };
}

const SECRET = "0x4AAAAAAAexample-secret";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyTurnstile", () => {
  it("passes a token Cloudflare accepts, sending the secret, the token, and the sender's address", async () => {
    const { fetcher, calls } = cloudflare({ body: { success: true, "error-codes": [] } });

    expect(await verifyTurnstile("a-token", { secret: SECRET, ip: "203.0.113.7", fetcher })).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(TURNSTILE_VERIFY_URL);
    expect(Object.fromEntries(calls[0].body)).toEqual({ secret: SECRET, response: "a-token", remoteip: "203.0.113.7" });
  });

  it("leaves the address out when it isn't known", async () => {
    const { fetcher, calls } = cloudflare({ body: { success: true } });

    await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher });
    expect(calls[0].body.has("remoteip")).toBe(false);
  });

  it("fails a token Cloudflare rejects, like one already used", async () => {
    const { fetcher } = cloudflare({ body: { success: false, "error-codes": ["timeout-or-duplicate"] } });

    expect(await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher })).toBe(false);
  });

  it.each([
    ["no token", null],
    ["an empty token", ""],
    ["a token longer than Cloudflare makes", "x".repeat(2049)],
  ])("fails %s without asking Cloudflare", async (_, token) => {
    const { fetcher, calls } = cloudflare({ body: { success: true } });

    expect(await verifyTurnstile(token, { secret: SECRET, ip: null, fetcher })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("fails and reports it when Cloudflare can't be reached or answers with an error", async () => {
    const reports: string[] = [];
    const report = (error: unknown) => reports.push(error instanceof Error ? error.message : String(error));
    const down = cloudflare(new TypeError("fetch failed"));
    const broken = cloudflare({ status: 500, body: { success: true } });

    expect(await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher: down.fetcher, report })).toBe(false);
    expect(await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher: broken.fetcher, report })).toBe(false);
    expect(reports).toEqual(["fetch failed", "Turnstile answered 500"]);
  });

  it("reports a secret Cloudflare refuses, since every form fails until it's fixed", async () => {
    const reports: string[] = [];
    const report = (error: unknown) => reports.push(error instanceof Error ? error.message : String(error));
    const { fetcher } = cloudflare({ body: { success: false, "error-codes": ["invalid-input-secret"] } });

    expect(await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher, report })).toBe(false);
    expect(reports).toEqual(["Turnstile refused the check: invalid-input-secret"]);
  });

  it.each(["invalid-input-response", "timeout-or-duplicate", "missing-input-response"])(
    "doesn't report a sender's own bad token (%s)",
    async (code) => {
      const report = vi.fn();
      const { fetcher } = cloudflare({ body: { success: false, "error-codes": [code] } });

      expect(await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher, report })).toBe(false);
      expect(report).not.toHaveBeenCalled();
    },
  );

  it("fails an answer that doesn't say success", async () => {
    const { fetcher } = cloudflare({ body: { "error-codes": [] } });

    expect(await verifyTurnstile("a-token", { secret: SECRET, ip: null, fetcher })).toBe(false);
  });
});
