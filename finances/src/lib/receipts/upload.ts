import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { UnusableFileError } from "@/lib/images/canvas";
import { extensionFor, processReceipt, type ReceiptMimeType } from "./compress";
import { sha256Hex } from "./hash";

export const RECEIPTS_BUCKET = "receipts";

/** Matches the per-request limit in the database. */
export const MAX_RECEIPTS = 10;

/** A receipt ready to upload: compressed, measured, and hashed. */
export type PreparedReceipt = {
  /** The picked file's name, kept for the record. */
  name: string;
  blob: Blob;
  mimeType: ReceiptMimeType;
  width: number | null;
  height: number | null;
  sha256: string;
};

/** Fits a picked file's name into the `original_filename` column. */
export function receiptFilename(name: string): string {
  return name.trim().slice(0, 255) || "receipt";
}

/** Where a receipt file lives in the bucket. The database checks this exact format. */
export function receiptPath(requestId: string, receiptId: string, mimeType: ReceiptMimeType): string {
  return `${requestId}/${receiptId}.${extensionFor(mimeType)}`;
}

/**
 * Compresses a picked file, then hashes the result. Throws a
 * `UnusableFileError` whose message is safe to show.
 */
export async function prepareReceipt(file: File): Promise<PreparedReceipt> {
  const processed = await processReceipt(file);

  let sha256: string;
  try {
    sha256 = await sha256Hex(processed.blob);
  } catch {
    // Web Crypto only exists on HTTPS and localhost.
    throw new UnusableFileError("Receipts can only be added on a secure connection. Open the app at its https:// address.");
  }

  return {
    name: receiptFilename(file.name),
    blob: processed.blob,
    mimeType: processed.mimeType,
    width: processed.width,
    height: processed.height,
    sha256,
  };
}

/**
 * Uploads a file for one of a request's receipts (`lineId`), then adds its
 * row. If the row can't be added, the file is deleted, so storage never keeps
 * a file the app can't see. Returns the new file's id.
 */
export async function uploadReceipt(
  supabase: SupabaseClient<Database>,
  requestId: string,
  lineId: string,
  receipt: PreparedReceipt,
): Promise<string> {
  const id = crypto.randomUUID();
  const path = receiptPath(requestId, id, receipt.mimeType);
  const bucket = supabase.storage.from(RECEIPTS_BUCKET);

  const upload = await bucket.upload(path, receipt.blob, { contentType: receipt.mimeType, upsert: false });
  if (upload.error) throw new Error(`Couldn't upload ${receipt.name}.`, { cause: upload.error });

  const { error } = await supabase.from("receipts").insert({
    id,
    request_id: requestId,
    line_id: lineId,
    storage_path: path,
    original_filename: receipt.name,
    mime_type: receipt.mimeType,
    size_bytes: receipt.blob.size,
    width: receipt.width,
    height: receipt.height,
    sha256: receipt.sha256,
  });

  if (error) {
    try {
      await bucket.remove([path]);
    } catch {
      // Nothing points at the file, so a leftover is unreachable. Report the real failure.
    }
    throw new Error(`Couldn't save ${receipt.name}.`, { cause: error });
  }

  return id;
}

/** A saved receipt: its row and where its file lives. */
export type StoredReceipt = { id: string; path: string };

/**
 * Deletes a saved receipt's file, then its row. If the row can't be deleted,
 * it only points at a missing file, and removing it again finishes the job.
 * The other way round could leave a file nothing points at.
 */
export async function removeReceipt(supabase: SupabaseClient<Database>, receipt: StoredReceipt): Promise<void> {
  const file = await supabase.storage.from(RECEIPTS_BUCKET).remove([receipt.path]);
  if (file.error) throw new Error("Couldn't delete the receipt file.", { cause: file.error });

  const { data, error } = await supabase.from("receipts").delete().eq("id", receipt.id).select("id");
  if (error) throw new Error("Couldn't remove the receipt.", { cause: error });
  // Nothing deleted means the request can't be edited anymore.
  if (data.length === 0) throw new Error("Couldn't remove the receipt.");
}
