import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import type { ProcessedPhoto } from "./compress";
import { uploadPhoto, type AddPhoto } from "./upload";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const webp: ProcessedPhoto = {
  mimeType: "image/webp",
  width: 1600,
  height: 1067,
  files: {
    lg: new Blob(["large photo bytes"], { type: "image/webp" }),
    sm: new Blob(["small photo bytes"], { type: "image/webp" }),
  },
};

/**
 * A stand-in for the Supabase client that records the calls in order.
 * `open` is what the storage check answers (null for an error), and
 * `failing` is the size whose upload errors, or throws like a dropped
 * connection.
 */
function fakeClient({
  open = true as boolean | null,
  failing = null as { size: "lg" | "sm"; how: "error" | "throw" } | null,
} = {}) {
  const calls: string[] = [];
  const bucket = {
    upload: vi.fn(async (path: string) => {
      calls.push(`upload ${path}`);
      if (failing && path.includes(`/${failing.size}.`)) {
        if (failing.how === "throw") throw new TypeError("Load failed");
        return { data: null, error: { message: "new row violates row-level security policy" } };
      }
      return { data: { path }, error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.push(`remove ${paths.join(",")}`);
      return { data: [], error: null };
    }),
  };
  const rpc = vi.fn(async (name: string) => {
    calls.push(`check ${name}`);
    return open === null ? { data: null, error: { message: "offline" } } : { data: open, error: null };
  });
  const client = { storage: { from: vi.fn(() => bucket) }, schema: vi.fn(() => ({ rpc })) };
  return { client: client as unknown as SupabaseClient<Database>, bucket, calls };
}

function fakeAdd(calls: string[], result: Awaited<ReturnType<AddPhoto>> = { status: "done", message: "Added." }) {
  return vi.fn<AddPhoto>(async (photo) => {
    calls.push(`add ${photo.id}`);
    return result;
  });
}

describe("uploadPhoto", () => {
  it("checks storage, uploads both sizes to a new random folder, then adds the row", async () => {
    const { client, bucket, calls } = fakeClient();
    const addPhoto = fakeAdd(calls);

    const result = await uploadPhoto(client, webp, "Hands raised during worship", addPhoto);

    expect(result).toEqual({ status: "done", id: expect.stringMatching(new RegExp(`^${UUID}$`)), message: "Added." });
    const id = result.status === "done" ? result.id : "";
    expect(calls).toEqual([
      "check photo_uploads_open",
      `upload ${id}/lg.webp`,
      `upload ${id}/sm.webp`,
      `add ${id}`,
    ]);
    expect(bucket.upload).toHaveBeenCalledWith(`${id}/lg.webp`, webp.files.lg, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
    expect(bucket.upload).toHaveBeenCalledWith(`${id}/sm.webp`, webp.files.sm, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
    expect(addPhoto).toHaveBeenCalledWith({ id, alt: "Hands raised during worship", width: 1600, height: 1067 });
  });

  it("names JPEG sizes .jpg", async () => {
    const { client, bucket, calls } = fakeClient();
    const jpeg: ProcessedPhoto = { ...webp, mimeType: "image/jpeg" };

    await uploadPhoto(client, jpeg, "A cabin in the trees", fakeAdd(calls));

    expect(bucket.upload.mock.calls.map(([path]) => path.replace(/^[^/]+/, ""))).toEqual(["/lg.jpg", "/sm.jpg"]);
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/\/lg\.jpg$/),
      jpeg.files.lg,
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
  });

  it("stops before uploading when storage is nearly full", async () => {
    const { client, calls } = fakeClient({ open: false });

    const result = await uploadPhoto(client, webp, "A cabin in the trees", fakeAdd(calls));

    expect(result).toEqual({
      status: "failed",
      message: "Storage is nearly full, so new photos can't go up. Take down photos the site no longer uses first.",
    });
    expect(calls).toEqual(["check photo_uploads_open"]);
  });

  it("still uploads when storage can't be checked, since the upload checks it again", async () => {
    const { client, calls } = fakeClient({ open: null });

    const result = await uploadPhoto(client, webp, "A cabin in the trees", fakeAdd(calls));

    expect(result.status).toBe("done");
  });

  it.each(["error", "throw"] as const)("deletes both files when an upload fails (%s)", async (how) => {
    const { client, calls } = fakeClient({ failing: { size: "sm", how } });
    const addPhoto = fakeAdd(calls);

    const result = await uploadPhoto(client, webp, "A cabin in the trees", addPhoto);

    expect(result).toEqual({
      status: "failed",
      message: "Couldn't upload the photo. Check your connection and try again.",
    });
    expect(addPhoto).not.toHaveBeenCalled();
    expect(calls.at(-1)).toMatch(new RegExp(`^remove ${UUID}/lg\.webp,${UUID}/sm\.webp$`));
  });

  it("deletes both files when the row can't be added, and says why", async () => {
    const { client, calls } = fakeClient();
    const addPhoto = fakeAdd(calls, { status: "failed", message: "Only site editors can add photos." });

    const result = await uploadPhoto(client, webp, "A cabin in the trees", addPhoto);

    expect(result).toEqual({ status: "failed", message: "Only site editors can add photos." });
    expect(calls.at(-1)).toMatch(new RegExp(`^remove ${UUID}/lg\.webp,${UUID}/sm\.webp$`));
  });

  it("deletes both files when the row's request drops", async () => {
    const { client, calls } = fakeClient();
    const addPhoto = vi.fn<AddPhoto>(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await uploadPhoto(client, webp, "A cabin in the trees", addPhoto);

    expect(result).toEqual({
      status: "failed",
      message: "Couldn't add the photo. Check your connection and try again.",
    });
    expect(calls.at(-1)).toMatch(/^remove /);
  });
});
