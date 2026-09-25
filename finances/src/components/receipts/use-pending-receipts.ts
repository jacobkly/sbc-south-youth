"use client";

import { useEffect, useRef, useState } from "react";
import { ReceiptFileError } from "@/lib/receipts/compress";
import { MAX_RECEIPTS, prepareReceipt, type PreparedReceipt } from "@/lib/receipts/upload";

export type PendingReceiptStatus = "processing" | "ready" | "uploading" | "uploaded" | "failed";

/** A receipt picked in a form but not saved yet. */
export type PendingReceipt = {
  key: string;
  name: string;
  status: PendingReceiptStatus;
  /** Set once processing finishes. */
  prepared: PreparedReceipt | null;
  /** Object URL of the prepared file, for previews. */
  url: string | null;
};

/**
 * Holds the receipts picked in a form. Each file is compressed and hashed as
 * soon as it's added, so saving only has to upload. `limit` is how many can
 * be picked, which is less when the request already has some saved.
 */
export function usePendingReceipts(limit: number = MAX_RECEIPTS) {
  const [receipts, setReceipts] = useState<PendingReceipt[]>([]);
  /** Why some picked files weren't added. Replaced on each pick. */
  const [problems, setProblems] = useState<string[]>([]);
  const queue = useRef(Promise.resolve());
  const nextKey = useRef(0);
  const removed = useRef(new Set<string>());
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);

  function update(key: string, change: Partial<PendingReceipt>) {
    setReceipts((current) => current.map((receipt) => (receipt.key === key ? { ...receipt, ...change } : receipt)));
  }

  function add(files: File[]) {
    const room = Math.max(0, limit - receipts.length);
    const accepted = files.slice(0, room);
    const skipped = files.length - accepted.length;
    setProblems(
      skipped > 0
        ? [`A request can have up to ${MAX_RECEIPTS} receipts, so ${skipped === 1 ? "1 file wasn't" : `${skipped} files weren't`} added.`]
        : [],
    );

    const items: PendingReceipt[] = accepted.map((file) => ({
      key: String(nextKey.current++),
      name: file.name || "receipt",
      status: "processing",
      prepared: null,
      url: null,
    }));
    setReceipts((current) => [...current, ...items]);

    items.forEach((item, index) => {
      const file = accepted[index];
      // One at a time: decoding several full-size photos at once can run a phone out of memory.
      queue.current = queue.current.then(async () => {
        if (removed.current.has(item.key)) return;
        try {
          const prepared = await prepareReceipt(file);
          if (removed.current.has(item.key)) return;
          const url = URL.createObjectURL(prepared.blob);
          urls.current.add(url);
          update(item.key, { status: "ready", prepared, url });
        } catch (error) {
          const reason = error instanceof ReceiptFileError ? error.message : "It couldn't be processed.";
          setReceipts((current) => current.filter((receipt) => receipt.key !== item.key));
          setProblems((current) => [...current, `${item.name}: ${reason}`]);
        }
      });
    });
  }

  function remove(key: string) {
    removed.current.add(key);
    const receipt = receipts.find((candidate) => candidate.key === key);
    if (receipt?.url) {
      URL.revokeObjectURL(receipt.url);
      urls.current.delete(receipt.url);
    }
    setReceipts((current) => current.filter((candidate) => candidate.key !== key));
  }

  function setStatus(key: string, status: PendingReceiptStatus) {
    update(key, { status });
  }

  /** Starts over with no receipts, for entering another request. */
  function clear() {
    for (const receipt of receipts) removed.current.add(receipt.key);
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setReceipts([]);
    setProblems([]);
  }

  return { receipts, problems, limit, add, remove, setStatus, clear };
}

export type PendingReceipts = ReturnType<typeof usePendingReceipts>;
