import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { markSeen } from "./mark-seen";

type Answer = { data: boolean | null; error: { message: string } | null };

/** A stand-in for the Supabase client that answers each function by name and records the calls. */
function fakeClient(answers: Partial<Record<"touch_last_seen" | "accept_invite", Answer>>) {
  const calls: string[] = [];
  const client = {
    rpc: vi.fn(async (name: "touch_last_seen" | "accept_invite") => {
      calls.push(name);
      return answers[name] ?? { data: null, error: { message: `no answer for ${name}` } };
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("markSeen", () => {
  it("accepts a pending invite on the visit that records being seen", async () => {
    const { client, calls } = fakeClient({
      touch_last_seen: { data: true, error: null },
      accept_invite: { data: true, error: null },
    });

    await markSeen(client);

    expect(calls).toEqual(["touch_last_seen", "accept_invite"]);
  });

  it("does nothing more when they were already seen this hour", async () => {
    const { client, calls } = fakeClient({ touch_last_seen: { data: false, error: null } });

    await markSeen(client);

    expect(calls).toEqual(["touch_last_seen"]);
  });

  it("logs a failed visit and skips the invite", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, calls } = fakeClient({ touch_last_seen: { data: null, error: { message: "offline" } } });

    await expect(markSeen(client)).resolves.toBeUndefined();

    expect(calls).toEqual(["touch_last_seen"]);
    expect(log).toHaveBeenCalledOnce();
  });

  it("logs a failed invite without throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      touch_last_seen: { data: true, error: null },
      accept_invite: { data: null, error: { message: "offline" } },
    });

    await expect(markSeen(client)).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledOnce();
  });

  it("logs a dropped connection without throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = { rpc: vi.fn().mockRejectedValue(new TypeError("fetch failed")) };

    await expect(markSeen(client as unknown as SupabaseClient<Database>)).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledOnce();
  });
});
