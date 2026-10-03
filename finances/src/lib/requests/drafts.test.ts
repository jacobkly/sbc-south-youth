import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { deleteDraft } from "./drafts";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-0000000000a1";

type Result = { data: unknown; error: object | null };

/**
 * A stand-in for the Supabase client. Each step answers from `answers`, and
 * `calls` records what ran, in order.
 */
function fakeClient(answers: { current?: Result; listed?: Result; removed?: Result; deleted?: Result }) {
  const calls: string[] = [];
  const {
    current = { data: { status: "draft", created_by: USER_ID }, error: null },
    listed = { data: [], error: null },
    removed = { data: [], error: null },
    deleted = { data: [{ id: REQUEST_ID }], error: null },
  } = answers;

  const bucket = {
    list: vi.fn(async (folder: string) => {
      calls.push(`list ${folder}`);
      return listed;
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.push(`remove ${paths.join(",")}`);
      return removed;
    }),
  };

  let deleting = false;
  const query = {
    select: vi.fn(() => (deleting ? Promise.resolve(deleted) : query)),
    delete: vi.fn(() => {
      deleting = true;
      calls.push("delete request");
      return query;
    }),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      calls.push("check");
      return current;
    }),
  };

  const client = { storage: { from: vi.fn(() => bucket) }, from: vi.fn(() => query) };
  return { client: client as unknown as SupabaseClient<Database>, calls };
}

const file = (name: string) => ({ id: `id-${name}`, name });

describe("deleteDraft", () => {
  it("deletes every file in the folder, then the request", async () => {
    const files = [file("r1.webp"), file("r2.pdf"), file("left-behind.jpg")];
    const { client, calls } = fakeClient({
      listed: { data: files, error: null },
      removed: { data: files, error: null },
    });

    expect(await deleteDraft(client, REQUEST_ID, USER_ID)).toBeNull();

    expect(calls).toEqual([
      "check",
      `list ${REQUEST_ID}`,
      `remove ${REQUEST_ID}/r1.webp,${REQUEST_ID}/r2.pdf,${REQUEST_ID}/left-behind.jpg`,
      "delete request",
    ]);
  });

  it("skips folders in the listing", async () => {
    const { client, calls } = fakeClient({ listed: { data: [{ id: null, name: "nested" }], error: null } });

    expect(await deleteDraft(client, REQUEST_ID, USER_ID)).toBeNull();

    expect(calls).toEqual(["check", `list ${REQUEST_ID}`, "delete request"]);
  });

  it("leaves everything alone when it isn't a draft anymore", async () => {
    const { client, calls } = fakeClient({ current: { data: { status: "submitted", created_by: USER_ID }, error: null } });

    expect(await deleteDraft(client, REQUEST_ID, USER_ID)).toMatch(/^This isn't a draft anymore/);

    expect(calls).toEqual(["check"]);
  });

  it("leaves someone else's draft alone", async () => {
    const { client, calls } = fakeClient({
      current: { data: { status: "draft", created_by: "00000000-0000-4000-8000-0000000000b2" }, error: null },
    });

    expect(await deleteDraft(client, REQUEST_ID, USER_ID)).toBe("Only the person who entered a draft can delete it.");

    expect(calls).toEqual(["check"]);
  });

  it("counts an already deleted draft as done", async () => {
    const { client, calls } = fakeClient({ current: { data: null, error: null } });

    expect(await deleteDraft(client, REQUEST_ID, USER_ID)).toBeNull();

    expect(calls).toEqual(["check"]);
  });

  it("keeps the request when some files weren't deleted", async () => {
    const files = [file("r1.webp"), file("r2.webp")];
    const { client, calls } = fakeClient({
      listed: { data: files, error: null },
      removed: { data: [files[0]], error: null },
    });

    expect(await deleteDraft(client, REQUEST_ID, USER_ID)).toMatch(/^Couldn't delete its receipts\./);

    expect(calls).not.toContain("delete request");
  });

  it("keeps the request when the files can't be listed or removed", async () => {
    const listFails = fakeClient({ listed: { data: null, error: { message: "offline" } } });
    expect(await deleteDraft(listFails.client, REQUEST_ID, USER_ID)).toBe("Check your connection and try again.");
    expect(listFails.calls).not.toContain("delete request");

    const removeFails = fakeClient({
      listed: { data: [file("r1.webp")], error: null },
      removed: { data: null, error: { message: "offline" } },
    });
    expect(await deleteDraft(removeFails.client, REQUEST_ID, USER_ID)).toMatch(/^Couldn't delete its receipts\./);
    expect(removeFails.calls).not.toContain("delete request");
  });

  it("reports a request delete that didn't go through", async () => {
    const blocked = fakeClient({ deleted: { data: [], error: null } });
    expect(await deleteDraft(blocked.client, REQUEST_ID, USER_ID)).toBe(
      "Only the person who entered a draft can delete it.",
    );

    const failed = fakeClient({ deleted: { data: null, error: { code: "08006" } } });
    expect(await deleteDraft(failed.client, REQUEST_ID, USER_ID)).toBe("Check your connection and try again.");
  });
});
