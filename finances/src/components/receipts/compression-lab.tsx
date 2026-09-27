"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, ImagePlusIcon, LoaderCircleIcon, ScanSearchIcon } from "lucide-react";
import { ReceiptCompare } from "@/components/receipts/receipt-compare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { canEncode } from "@/lib/images/canvas";
import { extensionFor, processReceipt, type ProcessedReceipt } from "@/lib/receipts/compress";
import { RECEIPT_COMPRESSION, type CompressionSettings, type OutputFormat } from "@/lib/receipts/compression-config";

const GIGABYTE = 1024 ** 3;
const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

type Entry = { id: string; file: File; url: string };

type Outcome =
  | { status: "pending" }
  | { status: "done"; receipt: ProcessedReceipt; url: string; ms: number }
  | { status: "error"; message: string };

/** The option list plus the configured value, so the current setting is always selectable. */
function optionsWith(options: number[], value: number): number[] {
  return [...new Set([...options, value])].sort((a, b) => a - b);
}

const SHORT_EDGES = optionsWith([1000, 1200, 1500, 2000], RECEIPT_COMPRESSION.shortEdge);
const LONG_CAPS = optionsWith([3000, 4000, 5000], RECEIPT_COMPRESSION.maxLongEdge);
const QUALITIES = optionsWith([0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9], RECEIPT_COMPRESSION.quality);
const FALLBACK_QUALITIES = optionsWith([0.6, 0.7, 0.8, 0.85], RECEIPT_COMPRESSION.jpegFallbackQuality);
const TARGET_KB = optionsWith([200, 250, 300, 400, 500], RECEIPT_COMPRESSION.targetBytes / 1024);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sameSettings(a: CompressionSettings, b: CompressionSettings): boolean {
  return (Object.keys(a) as (keyof CompressionSettings)[]).every((key) => a[key] === b[key]);
}

function downloadName(file: File, receipt: ProcessedReceipt): string {
  const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
  const shortEdge = Math.min(receipt.width ?? 0, receipt.height ?? 0);
  return `${base}-${shortEdge}px-q${receipt.quality}.${extensionFor(receipt.mimeType)}`;
}

/**
 * Dev tool for choosing receipt compression settings. Runs the real
 * upload pipeline (`processReceipt`) on local photos; nothing is uploaded.
 */
export function CompressionLab() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [settings, setSettings] = useState<CompressionSettings>(RECEIPT_COMPRESSION);
  const [webp, setWebp] = useState<boolean | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped when settings change or the batch is cleared, so stale runs stop.
  const generation = useRef(0);
  const objectUrls = useRef(new Set<string>());
  // Not crypto.randomUUID(), which needs HTTPS and the phone test runs over LAN http.
  const nextId = useRef(0);

  useEffect(() => {
    let active = true;
    canEncode("image/webp").then((supported) => active && setWebp(supported));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function createUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    return url;
  }

  function revokeUrl(url: string) {
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }

  function revokeResults() {
    for (const outcome of Object.values(outcomes)) {
      if (outcome.status === "done") revokeUrl(outcome.url);
    }
  }

  /** Compresses one file at a time, which keeps memory in check on a phone. */
  async function run(batch: Entry[], runSettings: CompressionSettings) {
    const runGeneration = generation.current;
    for (const entry of batch) {
      const started = performance.now();
      let outcome: Outcome;
      try {
        const receipt = await processReceipt(entry.file, runSettings);
        if (generation.current !== runGeneration) return;
        outcome = { status: "done", receipt, url: createUrl(receipt.blob), ms: performance.now() - started };
      } catch (error) {
        if (generation.current !== runGeneration) return;
        outcome = { status: "error", message: error instanceof Error ? error.message : "Couldn't process this file." };
      }
      setOutcomes((current) => ({ ...current, [entry.id]: outcome }));
    }
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const added = Array.from(files, (file) => ({ id: String(nextId.current++), file, url: createUrl(file) }));
    setEntries((current) => [...current, ...added]);
    setOutcomes((current) => ({ ...current, ...Object.fromEntries(added.map((entry) => [entry.id, { status: "pending" }])) }));
    void run(added, settings);
  }

  function changeSettings(patch: Partial<CompressionSettings>) {
    const next = { ...settings, ...patch };
    if (sameSettings(next, settings)) return;
    generation.current += 1;
    revokeResults();
    setSettings(next);
    setOutcomes(Object.fromEntries(entries.map((entry) => [entry.id, { status: "pending" }])));
    void run(entries, next);
  }

  function clearAll() {
    generation.current += 1;
    revokeResults();
    for (const entry of entries) revokeUrl(entry.url);
    setEntries([]);
    setOutcomes({});
  }

  const done = entries.flatMap((entry) => {
    const outcome = outcomes[entry.id];
    return outcome?.status === "done" ? [outcome] : [];
  });
  const pendingCount = entries.filter((entry) => outcomes[entry.id]?.status === "pending").length;
  const originalTotal = done.reduce((sum, outcome) => sum + outcome.receipt.original.size, 0);
  const compressedTotal = done.reduce((sum, outcome) => sum + outcome.receipt.blob.size, 0);
  const average = done.length > 0 ? compressedTotal / done.length : null;
  const comparingEntry = entries.find((entry) => entry.id === comparing);
  const comparingOutcome = comparingEntry && outcomes[comparingEntry.id];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dev only</p>
        <h1 className="text-2xl font-semibold tracking-tight">Receipt compression test</h1>
        <p className="text-sm text-muted-foreground">
          Pick receipt photos to see how they look after compression. Everything stays on this device.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button size="lg" className="h-11 flex-1 sm:flex-none" onClick={() => inputRef.current?.click()}>
          <ImagePlusIcon data-icon="inline-start" />
          Add photos
        </Button>
        {entries.length > 0 && (
          <Button size="lg" variant="outline" className="h-11" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Changing a setting recompresses every photo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SettingGroup
            label="Short edge"
            value={String(settings.shortEdge)}
            options={SHORT_EDGES.map((px) => ({ value: String(px), label: `${px}` }))}
            onChange={(value) => changeSettings({ shortEdge: Number(value) })}
          />
          <SettingGroup
            label="Long edge cap"
            value={String(settings.maxLongEdge)}
            options={LONG_CAPS.map((px) => ({ value: String(px), label: `${px}` }))}
            onChange={(value) => changeSettings({ maxLongEdge: Number(value) })}
          />
          <SettingGroup
            label="Format"
            value={settings.format}
            options={[
              { value: "image/webp", label: "WebP" },
              { value: "image/jpeg", label: "JPEG" },
            ]}
            onChange={(value) => changeSettings({ format: value as OutputFormat })}
          />
          <SettingGroup
            label="Quality"
            value={String(settings.quality)}
            options={QUALITIES.map((q) => ({ value: String(q), label: String(q) }))}
            onChange={(value) => changeSettings({ quality: Number(value) })}
          />
          <SettingGroup
            label="Target size"
            hint="Photos over this step down in quality, then size, until they fit."
            value={String(settings.targetBytes / 1024)}
            options={TARGET_KB.map((kb) => ({ value: String(kb), label: `${kb} KB` }))}
            onChange={(value) => changeSettings({ targetBytes: Number(value) * 1024 })}
          />
          {settings.format === "image/webp" && (
            <SettingGroup
              label="JPEG fallback quality"
              hint="Used when the browser can't encode WebP."
              value={String(settings.jpegFallbackQuality)}
              options={FALLBACK_QUALITIES.map((q) => ({ value: String(q), label: String(q) }))}
              onChange={(value) => changeSettings({ jpegFallbackQuality: Number(value) })}
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {webp === null ? "Checking WebP support…" : webp ? "This browser can save WebP." : "This browser can't save WebP, so it uses JPEG."}
            </p>
            <Button
              variant="outline"
              className="h-10"
              disabled={sameSettings(settings, RECEIPT_COMPRESSION)}
              onClick={() => changeSettings(RECEIPT_COMPRESSION)}
            >
              Reset to config
            </Button>
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <section aria-labelledby="summary-heading" aria-live="polite" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <h2 id="summary-heading" className="sr-only">
            Summary
          </h2>
          <Stat label="Photos" value={pendingCount > 0 ? `${done.length} of ${entries.length}` : String(done.length)} />
          <Stat
            label="Average size"
            value={average === null ? "–" : formatBytes(average)}
            tone={average === null ? undefined : average <= settings.targetBytes ? "good" : "bad"}
            detail={`Target ${formatBytes(settings.targetBytes)} or less`}
          />
          <Stat
            label="Total"
            value={formatBytes(compressedTotal)}
            detail={originalTotal > 0 ? `from ${formatBytes(originalTotal)}` : undefined}
          />
          <Stat
            label="Receipts per GB"
            value={average === null ? "–" : Math.floor(GIGABYTE / average).toLocaleString("en-US")}
          />
        </section>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
          <ImagePlusIcon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No photos yet</p>
          <p className="text-sm text-muted-foreground">Add a few real receipts, including long and faded ones.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <ReceiptRow
                entry={entry}
                outcome={outcomes[entry.id] ?? { status: "pending" }}
                onCompare={() => setComparing(entry.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {comparingEntry && comparingOutcome?.status === "done" && (
        <ReceiptCompare
          name={comparingEntry.file.name}
          original={{
            url: comparingEntry.url,
            width: comparingOutcome.receipt.original.width ?? 0,
            height: comparingOutcome.receipt.original.height ?? 0,
            label: "Original",
          }}
          compressed={{
            url: comparingOutcome.url,
            width: comparingOutcome.receipt.width ?? 0,
            height: comparingOutcome.receipt.height ?? 0,
            label: "Compressed",
          }}
          onClose={() => setComparing(null)}
        />
      )}
    </main>
  );
}

function SettingGroup({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={value}
        onValueChange={(next) => next && onChange(next)}
        aria-label={label}
        className="flex-wrap"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className={`h-10 min-w-12 px-3 ${SELECTED}`}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "good"
            ? "text-lg font-semibold text-green-700 dark:text-green-400"
            : tone === "bad"
              ? "text-lg font-semibold text-destructive"
              : "text-lg font-semibold"
        }
      >
        {value}
      </p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function ReceiptRow({
  entry,
  outcome,
  onCompare,
}: {
  entry: Entry;
  outcome: Outcome;
  onCompare: () => void;
}) {
  return (
    <Card size="sm" className="flex-row gap-3 px-3">
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {outcome.status === "done" && (
          // Blob URL of a local file, so next/image doesn't apply.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={outcome.url} alt="" className="size-full object-cover object-top" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-medium">{entry.file.name}</p>
        {outcome.status === "pending" && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Compressing…
          </p>
        )}
        {outcome.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {outcome.message}
          </p>
        )}
        {outcome.status === "done" && <ReceiptDetails entry={entry} outcome={outcome} onCompare={onCompare} />}
      </div>
    </Card>
  );
}

function ReceiptDetails({
  entry,
  outcome,
  onCompare,
}: {
  entry: Entry;
  outcome: Extract<Outcome, { status: "done" }>;
  onCompare: () => void;
}) {
  const { receipt } = outcome;
  const reduction = 1 - receipt.blob.size / receipt.original.size;

  return (
    <>
      <p className="text-sm">
        <span className="text-muted-foreground">{formatBytes(receipt.original.size)} →</span>{" "}
        <span className="font-medium">{formatBytes(receipt.blob.size)}</span>{" "}
        <span className="text-muted-foreground">({Math.round(reduction * 100)}% smaller)</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {receipt.original.width}×{receipt.original.height} → {receipt.width}×{receipt.height} ·{" "}
        {extensionFor(receipt.mimeType).toUpperCase()} q{receipt.quality} · {Math.round(outcome.ms)} ms
      </p>
      <div className="mt-auto flex gap-2 pt-1">
        <Button variant="outline" className="h-10 flex-1 sm:flex-none" onClick={onCompare}>
          <ScanSearchIcon data-icon="inline-start" />
          Compare
        </Button>
        <Button variant="outline" className="h-10 flex-1 sm:flex-none" asChild>
          <a href={outcome.url} download={downloadName(entry.file, receipt)}>
            <DownloadIcon data-icon="inline-start" />
            Download
          </a>
        </Button>
      </div>
    </>
  );
}
