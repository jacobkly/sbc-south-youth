import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { prepareReceipt, receiptFilename, receiptPath, uploadReceipt, type PreparedReceipt } from "./upload";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const photo: PreparedReceipt = {
  name: "test-receipt.jpg",
  blob: new Blob(["fake image bytes"], { type: "image/webp" }),
  mimeType: "image/webp",
  width: 1500,
  height: 2000,
  sha256: "a".repeat(64),
};

/** A stand-in for the Supabase client that records the calls the upload makes. */
function fakeClient({ uploadError = null as object | null, insertError = null as object | null } = {}) {
  const calls: string[] = [];
  const bucket = {
    upload: vi.fn(async (path: string) => {
      calls.push(`upload ${path}`);
      return uploadError ? { data: null, error: uploadError } : { data: { path }, error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.push(`remove ${paths.join(",")}`);
      return { data: [], error: null };
    }),
  };
  const table = {
    insert: vi.fn(async () => {
      calls.push("insert");
      return { error: insertError };
    }),
  };
  const client = { storage: { from: vi.fn(() => bucket) }, from: vi.fn(() => table) };
  return { client: client as unknown as SupabaseClient<Database>, bucket, table, calls };
}

describe("uploadReceipt", () => {
  it("uploads the file, then adds a row pointing at it", async () => {
    const { client, bucket, table, calls } = fakeClient();

    const id = await uploadReceipt(client, REQUEST_ID, photo);

    expect(id).toMatch(UUID);
    const path = `${REQUEST_ID}/${id}.webp`;
    expect(calls).toEqual([`upload ${path}`, "insert"]);
    expect(bucket.upload).toHaveBeenCalledWith(path, photo.blob, { contentType: "image/webp", upsert: false });
    expect(table.insert).toHaveBeenCalledWith({
      id,
      request_id: REQUEST_ID,
      storage_path: path,
      original_filename: "test-receipt.jpg",
      mime_type: "image/webp",
      size_bytes: photo.blob.size,
      width: 1500,
      height: 2000,
      sha256: "a".repeat(64),
    });
  });

  it("deletes the uploaded file when the row can't be added", async () => {
    const { client, calls } = fakeClient({ insertError: { code: "42501" } });

    await expect(uploadReceipt(client, REQUEST_ID, photo)).rejects.toThrow("Couldn't save test-receipt.jpg.");

    expect(calls).toHaveLength(3);
    const uploaded = calls[0].replace("upload ", "");
    expect(calls.slice(1)).toEqual(["insert", `remove ${uploaded}`]);
  });

  it("adds no row when the upload fails", async () => {
    const { client, calls } = fakeClient({ uploadError: { message: "Payload too large" } });

    await expect(uploadReceipt(client, REQUEST_ID, photo)).rejects.toThrow("Couldn't upload test-receipt.jpg.");

    expect(calls).toHaveLength(1);
  });

  it("still reports the row failure if the cleanup throws", async () => {
    const { client, bucket } = fakeClient({ insertError: { code: "23514" } });
    bucket.remove.mockRejectedValueOnce(new Error("offline"));

    await expect(uploadReceipt(client, REQUEST_ID, photo)).rejects.toThrow("Couldn't save test-receipt.jpg.");
  });
});

describe("receiptPath", () => {
  it("puts the file in its request's folder with the right extension", () => {
    expect(receiptPath(REQUEST_ID, "r1", "image/jpeg")).toBe(`${REQUEST_ID}/r1.jpg`);
    expect(receiptPath(REQUEST_ID, "r1", "application/pdf")).toBe(`${REQUEST_ID}/r1.pdf`);
  });
});

describe("receiptFilename", () => {
  it("fits the column and never ends up empty", () => {
    expect(receiptFilename("  scan.pdf ")).toBe("scan.pdf");
    expect(receiptFilename("x".repeat(300))).toHaveLength(255);
    expect(receiptFilename("")).toBe("receipt");
  });
});

describe("prepareReceipt", () => {
  it("passes a PDF through and hashes it", async () => {
    const file = new File(["%PDF-1.4 fake"], "test-invoice.pdf", { type: "application/pdf" });

    const prepared = await prepareReceipt(file);

    expect(prepared).toMatchObject({ name: "test-invoice.pdf", mimeType: "application/pdf", width: null, height: null });
    expect(prepared.blob.size).toBe(file.size);
    expect(prepared.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
