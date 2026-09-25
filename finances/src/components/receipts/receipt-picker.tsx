"use client";

import { useRef, useState } from "react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  FileTextIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import type { PendingReceipt } from "@/components/receipts/use-pending-receipts";
import { ReceiptViewer } from "@/components/receipts/receipt-viewer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAX_RECEIPTS } from "@/lib/receipts/upload";
import { cn } from "@/lib/utils";

/**
 * Adds receipt photos and PDFs to a form. On iOS the file input offers Take
 * Photo, Photo Library, and Files. On a computer, files can also be dropped.
 * Images open full screen with zoom, to check they're readable before saving.
 */
export function ReceiptPicker({
  id,
  receipts,
  problems,
  max = MAX_RECEIPTS,
  label = "Receipts",
  onAdd,
  onRemove,
  locked,
  describedBy,
}: {
  id: string;
  receipts: PendingReceipt[];
  /** Why some picked files weren't added. */
  problems: string[];
  /** How many can be picked, which is less when some are already saved. */
  max?: number;
  /** Names the list of picked files. */
  label?: string;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  /** True while saving, so nothing changes mid-upload. */
  locked?: boolean;
  describedBy?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<PendingReceipt | null>(null);

  const full = receipts.length >= max;
  const canAdd = !full && !locked;

  function pick() {
    input.current?.click();
  }

  return (
    <div
      className={cn("space-y-3 rounded-lg", dragging && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
      onDragOver={(event) => {
        if (!canAdd || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!canAdd) return;
        event.preventDefault();
        setDragging(false);
        onAdd(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        // Not `hidden`: some iOS versions ignore clicks on a display:none file input.
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          // Lets the same file be picked again after removing it.
          event.target.value = "";
        }}
      />

      {receipts.length === 0 ? (
        !full && (
          <Button
            type="button"
            id={id}
            variant="outline"
            disabled={locked}
            aria-describedby={describedBy}
            onClick={pick}
            className="h-24 w-full flex-col gap-1 border-dashed text-base font-normal md:text-sm"
          >
            <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
            <span>Add receipts</span>
            <span className="hidden text-sm text-muted-foreground md:inline">or drop files here</span>
          </Button>
        )
      ) : (
        <ul className="grid grid-cols-3 gap-2 md:grid-cols-4" aria-label={label}>
          {receipts.map((receipt) => (
            <li key={receipt.key}>
              <ReceiptTile
                receipt={receipt}
                locked={locked}
                onView={() => setViewing(receipt)}
                onRemove={() => onRemove(receipt.key)}
              />
            </li>
          ))}
          {canAdd && (
            <li>
              <Button
                type="button"
                id={id}
                variant="outline"
                aria-describedby={describedBy}
                onClick={pick}
                className="aspect-3/4 h-auto w-full flex-col gap-1 border-dashed font-normal"
              >
                <PlusIcon className="size-5 text-muted-foreground" aria-hidden />
                Add more
              </Button>
            </li>
          )}
        </ul>
      )}

      {problems.length > 0 && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>
            <ul className="space-y-1">
              {problems.map((problem) => (
                <li key={problem} className="break-words">
                  {problem}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {viewing?.url && viewing.prepared?.width && viewing.prepared.height && (
        <ReceiptViewer
          name={viewing.name}
          url={viewing.url}
          width={viewing.prepared.width}
          height={viewing.prepared.height}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

const STATUS_TEXT: Partial<Record<PendingReceipt["status"], string>> = {
  processing: "Preparing…",
  uploading: "Uploading…",
  uploaded: "Uploaded",
  failed: "Didn't upload",
};

function ReceiptTile({
  receipt,
  locked,
  onView,
  onRemove,
}: {
  receipt: PendingReceipt;
  locked?: boolean;
  onView: () => void;
  onRemove: () => void;
}) {
  const { name, status, prepared, url } = receipt;
  const isPdf = prepared?.mimeType === "application/pdf";
  const busy = status === "processing" || status === "uploading";
  // Uploaded files belong to the saved draft now; they're removed from its page.
  const removable = !locked && status !== "uploaded" && status !== "uploading";
  const statusText = STATUS_TEXT[status];

  const body =
    url && !isPdf ? (
      // Blob URL of a local file, so next/image doesn't apply.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="size-full object-cover" />
    ) : (
      <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
        {isPdf ? (
          <FileTextIcon className="size-6" aria-hidden />
        ) : (
          <LoaderCircleIcon className="size-6 animate-spin" aria-hidden />
        )}
        <span className="line-clamp-2 break-all">{name}</span>
      </span>
    );

  const frame = cn(
    "relative block aspect-3/4 w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
    status === "failed" && "border-destructive",
  );

  return (
    <div className="relative">
      {url && isPdf ? (
        <a href={url} target="_blank" rel="noopener" className={frame} aria-label={`Open ${name}`}>
          {body}
        </a>
      ) : url ? (
        <button type="button" className={frame} onClick={onView} aria-label={`View ${name}`}>
          {body}
        </button>
      ) : (
        <div className={frame} role="img" aria-label={`Preparing ${name}`}>
          {body}
        </div>
      )}

      {statusText && status !== "processing" && (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-background/90 px-1 py-0.5 text-xs font-medium",
            status === "failed" && "text-destructive",
          )}
        >
          {busy && <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />}
          {status === "uploaded" && <CircleCheckIcon className="size-3" aria-hidden />}
          {statusText}
        </span>
      )}

      {removable && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="absolute top-1 right-1 size-9 rounded-full border shadow-sm"
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
