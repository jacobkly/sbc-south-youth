import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { RECEIPTS_BUCKET } from "@/lib/receipts/upload";
import { formatRequestNumber } from "@/lib/requests/format";

/** A request in the report, with what its receipts are named by. */
export type ZipRequest = {
  id: string;
  request_number: number;
  purchase_date: string;
  payee: { full_name: string } | null;
};

/** A saved receipt, oldest first within its request. */
export type ZipReceipt = { request_id: string; storage_path: string; size_bytes: number };

/** A receipt file and its name in the ZIP. */
export type ZipEntry = { path: string; name: string; size: number };

/** Above this, the download gets a warning first. Phones can struggle with more. */
export const LARGE_ZIP_BYTES = 100_000_000;

/** How many downloads run at once. */
const PARALLEL_DOWNLOADS = 4;

/** How many request ids go in one query, so the URL stays short and under the row cap. */
const IDS_PER_QUERY = 50;

/**
 * A payee name as part of a file name: no characters Windows, macOS, or iOS
 * refuse, and not too long.
 */
export function fileNamePart(value: string): string {
  const safe = value
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .replace(/[. ]+$/, "")
    .trim();
  return safe || "Unknown payee";
}

function extension(path: string): string {
  return /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? "bin";
}

/**
 * Each receipt's name in the ZIP, like "R-0001_2026-03-14_Alex Example_1.webp",
 * in request number order. Receipts are numbered within their request.
 */
export function receiptZipEntries(requests: readonly ZipRequest[], receipts: readonly ZipReceipt[]): ZipEntry[] {
  const byRequest = new Map<string, ZipReceipt[]>();
  for (const receipt of receipts) {
    const group = byRequest.get(receipt.request_id);
    if (group) group.push(receipt);
    else byRequest.set(receipt.request_id, [receipt]);
  }

  return [...requests]
    .sort((a, b) => a.request_number - b.request_number)
    .flatMap((request) =>
      (byRequest.get(request.id) ?? []).map((receipt, index) => ({
        path: receipt.storage_path,
        name: [
          formatRequestNumber(request.request_number),
          request.purchase_date,
          fileNamePart(request.payee?.full_name ?? ""),
          `${index + 1}.${extension(receipt.storage_path)}`,
        ].join("_"),
        size: receipt.size_bytes,
      })),
    );
}

/** The saved receipts of these requests, oldest first within each. */
export async function loadZipReceipts(
  supabase: SupabaseClient<Database>,
  requestIds: readonly string[],
): Promise<ZipReceipt[]> {
  const receipts: ZipReceipt[] = [];
  for (let start = 0; start < requestIds.length; start += IDS_PER_QUERY) {
    const { data, error } = await supabase
      .from("receipts")
      .select("request_id, storage_path, size_bytes")
      .in("request_id", requestIds.slice(start, start + IDS_PER_QUERY))
      .order("created_at")
      .order("id");
    if (error) throw error;
    receipts.push(...data);
  }
  return receipts;
}

/**
 * Downloads the receipt files and puts them in a ZIP, in entry order.
 * `onProgress` gets how many are downloaded so far. The files are already
 * compressed, so the ZIP only stores them.
 */
export async function buildReceiptsZip(
  supabase: SupabaseClient<Database>,
  entries: readonly ZipEntry[],
  onProgress: (done: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const bucket = supabase.storage.from(RECEIPTS_BUCKET);
  const files: Blob[] = new Array(entries.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < entries.length) {
      signal.throwIfAborted();
      const index = next++;
      const { data, error } = await bucket.download(entries[index].path, undefined, { signal });
      if (error) throw new Error(`Couldn't download ${entries[index].name}.`, { cause: error });
      files[index] = data;
      onProgress(++done);
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, entries.length) }, worker));
  signal.throwIfAborted();

  const zip = new JSZip();
  entries.forEach((entry, index) => zip.file(entry.name, files[index]));
  return zip.generateAsync({ type: "blob", compression: "STORE", mimeType: "application/zip" });
}
