"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { CircleAlertIcon, FileTextIcon, ImageOffIcon, LoaderCircleIcon, Undo2Icon, XIcon } from "lucide-react";
import { ReceiptViewer } from "@/components/receipts/receipt-viewer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isJustSigned, isSignedUrlStale, signReceiptUrls, type SignedReceiptUrls } from "@/lib/receipts/signed-urls";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type GalleryReceipt = {
  id: string;
  path: string;
  name: string;
  mimeType: string;
  width: number | null;
  height: number | null;
};

const FRAME =
  "relative block aspect-3/4 w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring";

const PLACEHOLDER = "flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground";

/** "Receipt 2 of 3", or just "Receipt" when there's one. Saved file names aren't worth showing. */
function receiptTitle(index: number, count: number): string {
  return count > 1 ? `Receipt ${index + 1} of ${count}` : "Receipt";
}

/** Lets the edit form mark saved receipts to remove when it saves. */
export type GalleryRemoval = {
  /** Ids marked to remove. */
  marked: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** False when a marked one can't be kept, like when there's no room for it. */
  canKeep: boolean;
  /** True while saving. */
  locked: boolean;
};

/**
 * A saved request's receipts. Images open full screen, and PDFs open in a new
 * tab. The links expire after five minutes, so stale ones are re-signed
 * before a receipt opens and when the page comes back into view.
 */
export function ReceiptGallery({
  receipts,
  initial,
  label = "Receipts",
  removal,
}: {
  receipts: GalleryReceipt[];
  /** Links signed while the page rendered, or null if that failed. */
  initial: SignedReceiptUrls | null;
  /** Names the list. */
  label?: string;
  removal?: GalleryRemoval;
}) {
  const [signed, setSigned] = useState<SignedReceiptUrls>(initial ?? { urls: {}, signedAt: 0 });
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GalleryReceipt | null>(null);
  // Links that failed to load. A re-signed link gets another try.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const pending = useRef<Promise<SignedReceiptUrls | null> | null>(null);

  const refresh = useCallback(() => {
    pending.current ??= signReceiptUrls(
      createClient(),
      receipts.map((receipt) => receipt.path),
    ).then((result) => {
      pending.current = null;
      setFailed(!result);
      if (result) setSigned(result);
      return result;
    });
    return pending.current;
  }, [receipts]);

  const signedRef = useRef(signed);
  useEffect(() => {
    signedRef.current = signed;
  }, [signed]);

  useEffect(() => {
    const needsRefresh = () => {
      const { urls, signedAt } = signedRef.current;
      return isSignedUrlStale(signedAt) || receipts.some((receipt) => !urls[receipt.path]);
    };
    // A page restored from the back button can hold links that are long expired.
    if (needsRefresh()) void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible" && needsRefresh()) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [receipts, refresh]);

  /** Fresh links, re-signing first if they're about to expire. */
  async function freshUrls(): Promise<Record<string, string> | null> {
    if (!isSignedUrlStale(signed.signedAt)) return signed.urls;
    return (await refresh())?.urls ?? null;
  }

  async function openImage(receipt: GalleryReceipt) {
    setOpening(receipt.id);
    const urls = await freshUrls();
    setOpening(null);
    if (urls?.[receipt.path]) setViewing(receipt);
  }

  function openPdf(event: MouseEvent<HTMLAnchorElement>, receipt: GalleryReceipt) {
    if (!isSignedUrlStale(signed.signedAt)) return; // The link opens it.
    event.preventDefault();
    // Open the tab during the tap, or Safari blocks it, then point it at a fresh link.
    const tab = window.open("", "_blank");
    void refresh().then((result) => {
      const url = result?.urls[receipt.path];
      if (!tab) return;
      if (!url) {
        tab.close();
        return;
      }
      tab.opener = null;
      tab.location.replace(url);
    });
  }

  function onImageError(url: string) {
    setBroken((current) => new Set(current).add(url));
    // The phone's clock may be off, so a link can expire earlier than expected.
    if (!isJustSigned(signed.signedAt)) void refresh();
  }

  const viewingUrl = viewing ? signed.urls[viewing.path] : undefined;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2 md:grid-cols-4" aria-label={label}>
        {receipts.map((receipt, index) => {
          const url = signed.urls[receipt.path];
          const isPdf = receipt.mimeType === "application/pdf";
          const busy = opening === receipt.id;
          const named = receiptTitle(index, receipts.length).toLowerCase();

          let tile;
          if (!url || broken.has(url)) {
            tile = (
              <button
                type="button"
                className={FRAME}
                onClick={() => void refresh()}
                aria-label={`Couldn't load ${named}. Try again`}
              >
                <span className={PLACEHOLDER}>
                  <ImageOffIcon className="size-6" aria-hidden />
                  <span>Couldn&apos;t load. Tap to retry.</span>
                </span>
              </button>
            );
          } else if (isPdf) {
            tile = (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={FRAME}
                onClick={(event) => openPdf(event, receipt)}
                aria-label={`Open ${receipt.name} (PDF, opens in a new tab)`}
              >
                <span className={PLACEHOLDER}>
                  <FileTextIcon className="size-6" aria-hidden />
                  <span className="line-clamp-2 break-all">{receipt.name}</span>
                </span>
              </a>
            );
          } else {
            tile = (
              <button
                type="button"
                className={FRAME}
                onClick={() => void openImage(receipt)}
                aria-label={`View ${named}`}
                aria-busy={busy || undefined}
              >
                {/* Signed storage URLs, so next/image doesn't apply. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => onImageError(url)}
                  className="size-full object-cover"
                />
                {busy && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <LoaderCircleIcon className="size-6 animate-spin" aria-hidden />
                  </span>
                )}
              </button>
            );
          }

          if (!removal) return <li key={receipt.id}>{tile}</li>;

          const marked = removal.marked.has(receipt.id);
          return (
            <li key={receipt.id} className="relative">
              <div className={cn(marked && "opacity-40")}>{tile}</div>
              {marked && (
                <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded-md bg-background/90 px-1 py-0.5 text-center text-xs font-medium">
                  Removing
                </span>
              )}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => removal.onToggle(receipt.id)}
                disabled={removal.locked || (marked && !removal.canKeep)}
                aria-label={marked ? `Keep ${named}` : `Remove ${named}`}
                className="absolute top-1 right-1 size-9 rounded-full border shadow-sm"
              >
                {marked ? <Undo2Icon /> : <XIcon />}
              </Button>
            </li>
          );
        })}
      </ul>

      {failed && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>Couldn&apos;t load the receipts. Check your connection and try again.</AlertDescription>
        </Alert>
      )}

      {viewing && viewingUrl && (
        <ReceiptViewer
          title={receiptTitle(receipts.indexOf(viewing), receipts.length)}
          url={viewingUrl}
          width={viewing.width}
          height={viewing.height}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
