import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { deleteFolder } from "./files";

const ID = "0d3f6a8e-2b1c-4e5f-9a7b-1c2d3e4f5a6b";

/**
 * A stand-in for the Supabase client's photo bucket. `left` is what's
 * still in the folder after the delete, and `failing` makes the delete
 * error, or throw like a dropped connection.
 */
function fakeClient({ left = [] as string[], failing = null as "error" | "throw" | null } = {}) {
  const bucket = {
    remove: vi.fn(async (paths: string[]) => {
      if (failing === "throw") throw new TypeError("Load failed");
      if (failing === "error") return { data: null, error: { message: "offline" } };
      return { data: paths.map((name) => ({ name })), error: null };
    }),
    list: vi.fn(async () => ({ data: left.map((name) => ({ name })), error: null })),
  };
  const client = { storage: { from: vi.fn(() => bucket) } };
  return { client: client as unknown as SupabaseClient<Database>, bucket };
}

describe("deleteFolder", () => {
  it("deletes both sizes of either type, then checks the folder is empty", async () => {
    const { client, bucket } = fakeClient();

    expect(await deleteFolder(client, ID)).toBe(true);
    expect(client.storage.from).toHaveBeenCalledWith("site-photos");
    expect(bucket.remove).toHaveBeenCalledWith([`${ID}/lg.webp`, `${ID}/sm.webp`, `${ID}/lg.jpg`, `${ID}/sm.jpg`]);
    expect(bucket.list).toHaveBeenCalledWith(ID);
  });

  it("says the files are still there when storage skipped them", async () => {
    const { client } = fakeClient({ left: ["lg.webp"] });

    expect(await deleteFolder(client, ID)).toBe(false);
  });

  it("says the files are still there when the delete fails", async () => {
    for (const failing of ["error", "throw"] as const) {
      const { client, bucket } = fakeClient({ failing });

      expect(await deleteFolder(client, ID)).toBe(false);
      expect(bucket.list).not.toHaveBeenCalled();
    }
  });
});
