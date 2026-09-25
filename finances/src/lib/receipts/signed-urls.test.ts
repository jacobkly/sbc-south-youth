import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { isJustSigned, isSignedUrlStale, SIGNED_URL_SECONDS, signReceiptUrls } from "./signed-urls";

const A = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-00000000000a.webp";
const B = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-00000000000b.pdf";

/** A stand-in for the Supabase client whose storage answers with `result`. */
function fakeClient(result: object | (() => Promise<unknown>)) {
  const createSignedUrls = vi.fn(async () => (typeof result === "function" ? result() : result));
  const from = vi.fn(() => ({ createSignedUrls }));
  return { client: { storage: { from } } as unknown as SupabaseClient<Database>, from, createSignedUrls };
}

describe("isSignedUrlStale", () => {
  it("re-signs a minute before the links expire", () => {
    expect(isSignedUrlStale(0, 239_999)).toBe(false);
    expect(isSignedUrlStale(0, 240_000)).toBe(true);
  });
});

describe("isJustSigned", () => {
  it("covers the first ten seconds", () => {
    expect(isJustSigned(0, 9_999)).toBe(true);
    expect(isJustSigned(0, 10_000)).toBe(false);
  });
});

describe("signReceiptUrls", () => {
  it("signs every path in the private bucket for five minutes", async () => {
    const { client, from, createSignedUrls } = fakeClient({
      data: [
        { path: A, signedUrl: "https://example.test/a?token=1", error: null },
        { path: B, signedUrl: "https://example.test/b?token=2", error: null },
      ],
      error: null,
    });
    const result = await signReceiptUrls(client, [A, B]);
    expect(from).toHaveBeenCalledWith("receipts");
    expect(createSignedUrls).toHaveBeenCalledWith([A, B], SIGNED_URL_SECONDS);
    expect(result?.urls).toEqual({ [A]: "https://example.test/a?token=1", [B]: "https://example.test/b?token=2" });
  });

  it("leaves out files that couldn't be signed", async () => {
    const { client } = fakeClient({
      data: [
        { path: A, signedUrl: "https://example.test/a?token=1", error: null },
        { path: B, signedUrl: null, error: "Either the object does not exist or you do not have access to it" },
      ],
      error: null,
    });
    expect((await signReceiptUrls(client, [A, B]))?.urls).toEqual({ [A]: "https://example.test/a?token=1" });
  });

  it("returns null when signing fails or the connection drops", async () => {
    expect(await signReceiptUrls(fakeClient({ data: null, error: new Error("nope") }).client, [A])).toBeNull();
    const offline = fakeClient(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await signReceiptUrls(offline.client, [A])).toBeNull();
  });

  it("skips the request when there's nothing to sign", async () => {
    const { client, createSignedUrls } = fakeClient({ data: [], error: null });
    expect((await signReceiptUrls(client, []))?.urls).toEqual({});
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});
