"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, FileUpIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { TILE } from "@/components/requests/payment-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/lib/database.types";
import { formatDate, todayInLA } from "@/lib/dates";
import type { ImportProblem } from "@/lib/import/parse";
import {
  loadExistingTithes,
  matchingTithes,
  parseTitheImport,
  titheMonthTotals,
  type TitheMonthTotal,
  type TitheRow,
} from "@/lib/income/import";
import { INCOME_METHOD_LABELS, INCOME_METHODS, type IncomeMethod } from "@/lib/income/schema";
import { incomeHref } from "@/lib/income/view";
import { formatCents } from "@/lib/money";
import { appErrorMessage, RETRY_MESSAGE } from "@/lib/requests/actions";
import { createClient } from "@/lib/supabase/client";
import { Disclosure, monthLabel, ProblemList, rowCount, SummaryStat } from "./import-preview";

const TEXT_ID = "tithe-import-rows";
const METHOD_ID = "tithe-import-method";

// Plenty for a few thousand rows. Anything bigger isn't a two-column spreadsheet.
const MAX_FILE_BYTES = 2_000_000;

const SPREADSHEET_FILE = /\.(xlsx|xls|numbers|ods)$/i;

type TithePreviewData = { rows: TitheRow[]; problems: ImportProblem[]; matches: Set<number> };

type TitheImportResult = { tithes: number; totalCents: number };

function titheCount(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "tithe" : "tithes"}`;
}

function sumCents(rows: readonly TitheRow[]): number {
  return rows.reduce((total, row) => total + row.amount_cents, 0);
}

function readNumber(data: Json, key: string): number {
  const value = data && typeof data === "object" && !Array.isArray(data) ? data[key] : null;
  return typeof value === "number" ? value : 0;
}

/**
 * Imports tithes from a spreadsheet of dates and amounts: paste or choose a
 * file, check the preview, then import. Nothing is saved until the last
 * step, and then it's all or nothing.
 */
export function TitheImport() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<TithePreviewData | null>(null);
  const [result, setResult] = useState<TitheImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function check(source: string) {
    setError(null);
    const parsed = parseTitheImport(source, todayInLA());
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setChecking(true);
    try {
      const existing = await loadExistingTithes(createClient(), parsed.rows);
      setPreview({ rows: parsed.rows, problems: parsed.problems, matches: matchingTithes(parsed.rows, existing) });
      window.scrollTo({ top: 0 });
    } catch {
      setError(`Couldn't check which tithes are already in the app. ${RETRY_MESSAGE}`);
    } finally {
      setChecking(false);
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (SPREADSHEET_FILE.test(file.name)) {
      setError("Save the spreadsheet as a CSV file first, then choose that file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is too big. Choose a CSV with just the Date and Amount columns.");
      return;
    }
    try {
      const content = await file.text();
      setText(content);
      await check(content);
    } catch {
      setError("Couldn't read that file. Try choosing it again.");
    }
  }

  function startOver() {
    setPreview(null);
    setResult(null);
    setError(null);
    setText("");
    window.scrollTo({ top: 0 });
  }

  if (result) return <TitheImportDone result={result} onImportMore={startOver} />;

  if (preview) {
    return (
      <TithePreview
        preview={preview}
        onBack={() => {
          setPreview(null);
          window.scrollTo({ top: 0 });
        }}
        onImported={(done) => {
          setResult(done);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void check(text);
      }}
    >
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Add tithes from a spreadsheet with the columns <span className="font-medium text-foreground">Date, Amount</span>.
          A header row is optional, and with one, any other columns are left out.
        </p>
        <p>Tithes are saved without names. You&apos;ll see a preview with totals by month before anything is saved.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField id={TEXT_ID} label="Rows" hint="Copy the rows from your spreadsheet and paste them here.">
        <Textarea
          id={TEXT_ID}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          aria-describedby={`${TEXT_ID}-hint`}
          placeholder={"1/4/2026\t25.00"}
          rows={8}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={checking}
          className="min-h-40 font-mono text-sm desktop:text-xs"
        />
      </FormField>

      <div className="flex flex-col gap-2 desktop:flex-row">
        <Button type="submit" className="h-11 px-6" disabled={checking || !text.trim()}>
          {checking ? "Checking…" : "Preview import"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-6"
          disabled={checking}
          onClick={() => fileRef.current?.click()}
        >
          <FileUpIcon aria-hidden />
          Choose a CSV file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void chooseFile(file);
          }}
        />
      </div>
    </form>
  );
}

/** The preview: what will be imported, what's wrong, and how it came in. */
function TithePreview({
  preview,
  onBack,
  onImported,
}: {
  preview: TithePreviewData;
  onBack: () => void;
  onImported: (result: TitheImportResult) => void;
}) {
  const { rows, problems, matches } = preview;
  const [skipMatches, setSkipMatches] = useState(true);
  // Tithes come in through Cash App, so that's the usual answer.
  const [method, setMethod] = useState<IncomeMethod>("cash_app");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const skipped = skipMatches ? matches : new Set<number>();
  const toImport = rows.filter((row) => !skipped.has(row.line));
  const blocked = problems.length > 0 || toImport.length === 0;
  const total = sumCents(toImport);

  async function runImport() {
    setPending(true);
    const { data, error } = await createClient().rpc("import_tithes", { p_rows: toImport, p_method: method });
    setPending(false);

    if (error) {
      setConfirming(false);
      setImportError(`Nothing was imported. ${appErrorMessage(error) ?? RETRY_MESSAGE}`);
      window.scrollTo({ top: 0 });
      return;
    }
    onImported({ tithes: readNumber(data, "tithes"), totalCents: readNumber(data, "total_cents") });
  }

  return (
    <div className="space-y-6">
      {importError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="tithe-import-summary-heading" className="space-y-3">
        <h2 id="tithe-import-summary-heading" className="text-lg font-semibold">
          Preview
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <SummaryStat label="To import" value={titheCount(toImport.length)} note={formatCents(total)} />
          <SummaryStat
            label="Already in the app"
            value={matches.size.toLocaleString("en-US")}
            note={matches.size > 0 ? (skipMatches ? "Skipped" : "Imported again") : undefined}
          />
          <SummaryStat label="Problems" value={problems.length.toLocaleString("en-US")} />
        </dl>
      </section>

      {problems.length > 0 && <ProblemList problems={problems} />}

      {matches.size > 0 && (
        <div className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <Label htmlFor="tithe-import-skip-matches" className="text-base font-normal desktop:text-sm">
              Skip rows already in the app
            </Label>
            <Switch
              id="tithe-import-skip-matches"
              checked={skipMatches}
              onCheckedChange={setSkipMatches}
              aria-describedby="tithe-import-skip-matches-hint"
            />
          </div>
          <p id="tithe-import-skip-matches-hint" className="text-sm text-muted-foreground">
            {rowCount(matches.size)} {matches.size === 1 ? "matches" : "match"} a tithe with the same date and amount.
            Leave this on unless they&apos;re separate gifts.
          </p>
        </div>
      )}

      <FormField
        id={METHOD_ID}
        label="How they came in"
        hint="The spreadsheet doesn't say, so every tithe gets this."
        group
      >
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as IncomeMethod)}
          aria-labelledby={`${METHOD_ID}-label`}
          aria-describedby={`${METHOD_ID}-hint`}
          className="grid-cols-2 gap-3"
        >
          {INCOME_METHODS.map((option) => (
            <Label key={option} htmlFor={`${METHOD_ID}-${option}`} className={TILE}>
              <RadioGroupItem id={`${METHOD_ID}-${option}`} value={option} />
              {INCOME_METHOD_LABELS[option]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      {rows.length > 0 && <TitheMonthTotals months={titheMonthTotals(rows)} />}

      {rows.length > 0 && (
        <Disclosure summary={`All rows (${rows.length.toLocaleString("en-US")})`}>
          <TitheRowList rows={rows} skipped={skipped} />
        </Disclosure>
      )}

      <p className="text-sm text-muted-foreground">
        Each row is saved as a tithe on its date, with no name. Activity shows the import as one entry.
      </p>

      <div className="flex flex-col gap-2 desktop:flex-row">
        <Button
          type="button"
          className="h-11 px-6"
          disabled={blocked}
          onClick={() => {
            setImportError(null);
            setConfirming(true);
          }}
        >
          {toImport.length > 0 ? `Import ${titheCount(toImport.length)}` : "Nothing to import"}
        </Button>
        <Button type="button" variant="outline" className="h-11 px-6" onClick={onBack}>
          Change the rows
        </Button>
      </div>

      <Sheet open={confirming} onOpenChange={(open) => !open && !pending && setConfirming(false)}>
        <ResponsiveSheetContent>
          <SheetHeader className="pr-12">
            <SheetTitle>Import {titheCount(toImport.length)}?</SheetTitle>
            <SheetDescription>
              This adds {titheCount(toImport.length)} totaling {formatCents(total)}, all as {INCOME_METHOD_LABELS[method]}.
              To undo it later, you&apos;d delete each tithe one at a time.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
                Go back
              </Button>
            </SheetClose>
            <Button type="button" className="h-11 desktop:min-w-28" disabled={pending} onClick={() => void runImport()}>
              {pending ? "Importing…" : "Import"}
            </Button>
          </div>
        </ResponsiveSheetContent>
      </Sheet>
    </div>
  );
}

/** How many tithes and how much each month, to check against the spreadsheet before importing. */
function TitheMonthTotals({ months }: { months: TitheMonthTotal[] }) {
  const count = months.reduce((sum, month) => sum + month.count, 0);
  const total = months.reduce((sum, month) => sum + month.total, 0);

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>
          <h2>Totals by month</h2>
        </CardTitle>
        <CardDescription>Every row, including skipped ones. These should match your spreadsheet.</CardDescription>
      </CardHeader>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Tithes and totals by month</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-2 py-2 text-left font-normal">
                Month
              </th>
              <th scope="col" className="px-2 py-2 text-right font-normal">
                Tithes
              </th>
              <th scope="col" className="px-2 py-2 text-right font-normal">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {months.map((month) => (
              <tr key={month.month}>
                <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                  {monthLabel(month.month)}
                </th>
                <td className="px-2 py-2 text-right">{month.count.toLocaleString("en-US")}</td>
                <td className="px-2 py-2 text-right font-medium">{formatCents(month.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr>
              <th scope="row" className="px-2 py-2 text-left">
                Total
              </th>
              <td className="px-2 py-2 text-right">{count.toLocaleString("en-US")}</td>
              <td className="px-2 py-2 text-right font-semibold">{formatCents(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/** Every row as it will be saved. Rows already in the app are marked when they'll be skipped. */
function TitheRowList({ rows, skipped }: { rows: TitheRow[]; skipped: Set<number> }) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.line} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium tabular-nums">{formatCents(row.amount_cents)}</p>
            <p className="text-sm text-muted-foreground">
              Row {row.line} · {formatDate(row.date)}
            </p>
          </div>
          {skipped.has(row.line) && <Badge variant="outline">Skipped</Badge>}
        </li>
      ))}
    </ul>
  );
}

function TitheImportDone({ result, onImportMore }: { result: TitheImportResult; onImportMore: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          <CircleCheckIcon className="size-6" />
        </span>
        <div className="space-y-1" role="status">
          <h2 className="font-semibold">Imported {titheCount(result.tithes)}</h2>
          <p className="text-sm text-muted-foreground">{formatCents(result.totalCents)} in all.</p>
        </div>
        <div className="flex w-full flex-col gap-2 desktop:w-auto desktop:flex-row">
          <Button className="h-11 px-5" asChild>
            <Link href={incomeHref("youth")}>View tithes</Link>
          </Button>
          <Button variant="outline" className="h-11 px-5" onClick={onImportMore}>
            Import more
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
