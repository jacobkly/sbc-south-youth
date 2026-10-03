import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import type { ProcessedAvatar } from "./compress";
import { avatarPath, removeAvatar, saveAvatar } from "./upload";

const USER_ID = "00000000-0000-4000-8000-00000000a001";
const PATH = new RegExp(`^${USER_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$`);

const picture: ProcessedAvatar = {
  blob: new Blob(["fake picture bytes"], { type: "image/webp" }),
  mimeType: "image/webp",
  size: 256,
  quality: 0.8,
};

/**
 * A stand-in for the Supabase client that records the calls in order.
 * `stored` is what the user's folder lists; the row update answers with
 * `rows` rows or `updateError`.
 */
function fakeClient({
  uploadError = null as object | null,
  updateError = null as object | null,
  rows = 1,
  stored = [] as string[],
  listError = null as object | null,
} = {}) {
  const calls: string[] = [];
  const bucket = {
    upload: vi.fn(async (path: string) => {
      calls.push(`upload ${path}`);
      return uploadError ? { data: null, error: uploadError } : { data: { path }, error: null };
    }),
    list: vi.fn(async (folder: string) => {
      calls.push(`list ${folder}`);
      return listError ? { data: null, error: listError } : { data: stored.map((name) => ({ name })), error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.push(`remove ${paths.join(",")}`);
      return { data: [], error: null };
    }),
  };
  const query = {
    update: vi.fn((values: { avatar_path: string | null }) => {
      calls.push(`set ${values.avatar_path}`);
      return query;
    }),
    eq: vi.fn(() => query),
    select: vi.fn(async () =>
      updateError
        ? { data: null, error: updateError }
        : { data: Array.from({ length: rows }, () => ({ id: USER_ID })), error: null },
    ),
  };
  const client = { storage: { from: vi.fn(() => bucket) }, from: vi.fn(() => query) };
  return { client: client as unknown as SupabaseClient<Database>, bucket, query, calls };
}

describe("avatarPath", () => {
  it("puts the picture in the user's folder with the right extension", () => {
    expect(avatarPath(USER_ID, "p1", "image/webp")).toBe(`${USER_ID}/p1.webp`);
    expect(avatarPath(USER_ID, "p1", "image/jpeg")).toBe(`${USER_ID}/p1.jpg`);
  });
});

describe("saveAvatar", () => {
  it("uploads a new file, points the user at it, then deletes the old files", async () => {
    const { client, bucket, query, calls } = fakeClient({ stored: ["old-1.webp", "old-2.jpg"] });

    const path = await saveAvatar(client, USER_ID, picture);

    expect(path).toMatch(PATH);
    expect(bucket.upload).toHaveBeenCalledWith(path, picture.blob, { contentType: "image/webp", upsert: false });
    expect(query.eq).toHaveBeenCalledWith("id", USER_ID);
    expect(calls).toEqual([
      `upload ${path}`,
      `set ${path}`,
      `list ${USER_ID}`,
      `remove ${USER_ID}/old-1.webp,${USER_ID}/old-2.jpg`,
    ]);
  });

  it("never deletes the new file while cleaning up", async () => {
    const { client, bucket, calls } = fakeClient();
    // The folder lists only the file that was just uploaded.
    bucket.list.mockImplementationOnce(async () => ({ data: [{ name: calls[0].split("/")[1] }], error: null }));

    await saveAvatar(client, USER_ID, picture);

    expect(bucket.list).toHaveBeenCalled();
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("adds nothing to the user when the upload fails", async () => {
    const { client, calls } = fakeClient({ uploadError: { message: "Payload too large" } });

    await expect(saveAvatar(client, USER_ID, picture)).rejects.toThrow("Couldn't upload your picture.");

    expect(calls).toHaveLength(1);
  });

  it("deletes the uploaded file when the user can't be pointed at it", async () => {
    for (const failure of [{ rows: 0 }, { updateError: { code: "23514" } }]) {
      const { client, calls } = fakeClient(failure);

      await expect(saveAvatar(client, USER_ID, picture)).rejects.toThrow("Couldn't save your picture.");

      const uploaded = calls[0].replace("upload ", "");
      expect(calls).toEqual([`upload ${uploaded}`, `set ${uploaded}`, `remove ${uploaded}`]);
    }
  });

  it("still saves when the old files can't be cleaned up", async () => {
    const { client } = fakeClient({ listError: { message: "offline" } });

    await expect(saveAvatar(client, USER_ID, picture)).resolves.toMatch(PATH);
  });
});

describe("removeAvatar", () => {
  it("clears the user's picture, then deletes their files", async () => {
    const { client, calls } = fakeClient({ stored: ["p1.webp"] });

    await removeAvatar(client, USER_ID);

    expect(calls).toEqual(["set null", `list ${USER_ID}`, `remove ${USER_ID}/p1.webp`]);
  });

  it("keeps the files when the picture can't be cleared", async () => {
    const { client, calls } = fakeClient({ rows: 0, stored: ["p1.webp"] });

    await expect(removeAvatar(client, USER_ID)).rejects.toThrow("Couldn't remove your picture.");

    expect(calls).toEqual(["set null"]);
  });
});
