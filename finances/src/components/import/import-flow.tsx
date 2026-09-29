"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, FileUpIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { ApproverField, TILE } from "@/components/requests/payment-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/lib/database.types";
import { todayInLA } from "@/lib/dates";
import { parseImport, type ImportProblem, type ImportRow } from "@/lib/import/parse";
import { loadImportContext, monthTotals, planImport, type ImportPlan } from "@/lib/import/plan";
import { formatCents } from "@/lib/money";
import {
  appErrorMessage,
  MAX_EXTERNAL_APPROVER,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  RETRY_MESSAGE,
  type PaymentMethod,
} from "@/lib/requests/actions";
import { DEFAULT_QUEUE_FILTERS, queueHref } from "@/lib/requests/queue";
import { createClient } from "@/lib/supabase/client";
import {
  Disclosure,
  MonthTotals,
  newPayeeCount,
  ProblemList,
  requestCount,
  rowCount,
  RowList,
  SummaryStat,
} from "./import-preview";

const TEXT_ID = "import-rows";
const METHOD_ID = "import-method";
const ID_PREFIX = "import";

// Plenty for a few thousand rows. Anything bigger isn't a five-column spreadsheet.
const MAX_FILE_BYTES = 2_000_000;

const SPREADSHEET_FILE = /\.(xlsx|xls|numbers|ods)$/i;

export type ImportPreviewData = { rows: ImportRow[]; problems: ImportProblem[]; plan: ImportPlan };

export type ImportResult = { requests: number; payees: number };

function sumCents(rows: readonly ImportRow[]): number {
  return rows.reduce((total, row) => total + row.amount_cents, 0);
}

function readCount(data: Json, key: keyof ImportResult): number {
  const value = data && typeof data === "object" && !Array.isArray(data) ? data[key] : null;
  return typeof value === "number" ? value : 0;
}

/**
 * Imports paid reimbursements from a spreadsheet: paste or choose a file,
 * check the preview, then import. Nothing is saved until the last step, and
 * then it's all or nothing.
 */
export function ImportFlow({
  currentUserId,
  allowExternalApproval,
}: {
  currentUserId: string;
  allowExternalApproval: boolean;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function check(source: string) {
    setError(null);
    const parsed = parseImport(source, todayInLA());
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setChecking(true);
    try {
      const context = await loadImportContext(createClient(), parsed.rows);
      setPreview({
        rows: parsed.rows,
        problems: parsed.problems,
        plan: planImport(parsed.rows, context.payees, context.existing, currentUserId),
      });
      window.scrollTo({ top: 0 });
    } catch {
      setError(`Couldn't check which rows are already in the app. ${RETRY_MESSAGE}`);
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
      setError("That file is too big. Choose a CSV with just the Date, Name, Amount, Type, and Notes columns.");
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

  if (result) return <ImportDone result={result} onImportMore={startOver} />;

  if (preview) {
    return (
      <ImportPreview
        preview={preview}
        allowExternalApproval={allowExternalApproval}
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
          Add requests that were already paid from a spreadsheet with the columns{" "}
          <span className="font-medium text-foreground">Date, Name, Amount, Type, Notes</span>. A header row is
          optional. Type is Cafe or Youth, and Notes can be blank.
        </p>
        <p>You&apos;ll see a preview with totals by month before anything is saved.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField
        id={TEXT_ID}
        label="Rows"
        hint="Copy the rows from your spreadsheet and paste them here."
      >
        <Textarea
          id={TEXT_ID}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          aria-describedby={`${TEXT_ID}-hint`}
          placeholder={"1/15/2026\tAlex Example\t12.50\tYouth\tPizza night"}
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

/** The preview: what will be imported, what's wrong, and how it's paid. */
export function ImportPreview({
  preview,
  allowExternalApproval,
  onBack,
  onImported,
}: {
  preview: ImportPreviewData;
  allowExternalApproval: boolean;
  onBack: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const { rows, problems, plan } = preview;
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("cash_app");
  const [approver, setApprover] = useState("");
  const [approverError, setApproverError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const skipped = skipDuplicates ? plan.duplicates : new Set<number>();
  const toImport = rows.filter((row) => !skipped.has(row.line));
  const selfCount = toImport.filter((row) => plan.selfRows.has(row.line)).length;
  const selfBlocked = selfCount > 0 && !allowExternalApproval;
  const blocked = problems.length > 0 || selfBlocked || toImport.length === 0;
  const total = sumCents(toImport);

  function confirm() {
    if (selfCount > 0) {
      const name = approver.trim();
      const message = !name
        ? `Enter who approved ${selfCount === 1 ? "it" : "them"}.`
        : name.length > MAX_EXTERNAL_APPROVER
          ? `Keep the name to ${MAX_EXTERNAL_APPROVER} characters or fewer.`
          : undefined;
      setApproverError(message);
      if (message) {
        document.getElementById(`${ID_PREFIX}-external_approver`)?.focus();
        return;
      }
    }
    setImportError(null);
    setConfirming(true);
  }

  async function runImport() {
    setPending(true);
    const { data, error } = await createClient().rpc("import_paid_requests", {
      p_rows: toImport,
      p_method: method,
      p_external_approver: selfCount > 0 ? approver.trim() : undefined,
    });
    setPending(false);

    if (error) {
      setConfirming(false);
      setImportError(`Nothing was imported. ${appErrorMessage(error) ?? RETRY_MESSAGE}`);
      window.scrollTo({ top: 0 });
      return;
    }
    onImported({ requests: readCount(data, "requests"), payees: readCount(data, "payees") });
  }

  return (
    <div className="space-y-6">
      {importError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="import-summary-heading" className="space-y-3">
        <h2 id="import-summary-heading" className="text-lg font-semibold">
          Preview
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryStat label="To import" value={requestCount(toImport.length)} note={formatCents(total)} />
          <SummaryStat label="New payees" value={plan.newPayees.length.toLocaleString("en-US")} />
          <SummaryStat
            label="Already in the app"
            value={plan.duplicates.size.toLocaleString("en-US")}
            note={plan.duplicates.size > 0 ? (skipDuplicates ? "Skipped" : "Imported again") : undefined}
          />
          <SummaryStat label="Problems" value={problems.length.toLocaleString("en-US")} />
        </dl>
      </section>

      {problems.length > 0 && <ProblemList problems={problems} />}

      {plan.duplicates.size > 0 && (
        <div className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <Label htmlFor="import-skip-duplicates" className="text-base font-normal desktop:text-sm">
              Skip rows already in the app
            </Label>
            <Switch
              id="import-skip-duplicates"
              checked={skipDuplicates}
              onCheckedChange={setSkipDuplicates}
              aria-describedby="import-skip-duplicates-hint"
            />
          </div>
          <p id="import-skip-duplicates-hint" className="text-sm text-muted-foreground">
            {rowCount(plan.duplicates.size)} {plan.duplicates.size === 1 ? "matches" : "match"} a request with the same
            payee, date, and amount. Leave this on unless they&apos;re separate purchases.
          </p>
        </div>
      )}

      <FormField id={METHOD_ID} label="Paid with" hint="The spreadsheet doesn't say, so every row gets this." group>
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as PaymentMethod)}
          aria-labelledby={`${METHOD_ID}-label`}
          aria-describedby={`${METHOD_ID}-hint`}
          className="grid-cols-2 gap-3"
        >
          {PAYMENT_METHODS.map((option) => (
            <Label key={option} htmlFor={`${METHOD_ID}-${option}`} className={TILE}>
              <RadioGroupItem id={`${METHOD_ID}-${option}`} value={option} />
              {PAYMENT_METHOD_LABELS[option]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      {selfCount > 0 &&
        (selfBlocked ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>
              {rowCount(selfCount)} {selfCount === 1 ? "is" : "are"} paid to you, and external approval is off. Turn
              it on in Settings, or have another admin import them.
            </AlertDescription>
          </Alert>
        ) : (
          <ApproverField
            idPrefix={ID_PREFIX}
            value={approver}
            onChange={(value) => {
              setApprover(value);
              setApproverError(undefined);
            }}
            error={approverError}
            hint={`${rowCount(selfCount)} ${selfCount === 1 ? "is" : "are"} paid to you, so enter who approved ${selfCount === 1 ? "it" : "them"}.`}
          />
        ))}

      {rows.length > 0 && <MonthTotals months={monthTotals(rows)} />}

      <div className="space-y-3">
        {plan.newPayees.length > 0 && (
          <Disclosure summary={`New payees (${plan.newPayees.length.toLocaleString("en-US")})`}>
            <ul className="divide-y">
              {plan.newPayees.map((name) => (
                <li key={name} className="px-4 py-2.5">
                  {name}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        {rows.length > 0 && (
          <Disclosure summary={`All rows (${rows.length.toLocaleString("en-US")})`}>
            <RowList rows={rows} payeeNames={plan.payeeNames} skipped={skipped} />
          </Disclosure>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Each row is saved as paid on its date, with no vendor or receipt, and “Imported from spreadsheet” as the
        reason. Notes become the description.
      </p>

      <div className="flex flex-col gap-2 desktop:flex-row">
        <Button type="button" className="h-11 px-6" disabled={blocked} onClick={confirm}>
          {toImport.length > 0 ? `Import ${requestCount(toImport.length)}` : "Nothing to import"}
        </Button>
        <Button type="button" variant="outline" className="h-11 px-6" onClick={onBack}>
          Change the rows
        </Button>
      </div>

      <Sheet open={confirming} onOpenChange={(open) => !open && !pending && setConfirming(false)}>
        <ResponsiveSheetContent>
          <SheetHeader className="pr-12">
            <SheetTitle>Import {requestCount(toImport.length)}?</SheetTitle>
            <SheetDescription>
              This adds {requestCount(toImport.length)} totaling {formatCents(total)}
              {plan.newPayees.length > 0 ? ` and ${newPayeeCount(plan.newPayees.length)}` : ""}. To undo it later,
              you&apos;d undo each request one at a time.
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

export function ImportDone({ result, onImportMore }: { result: ImportResult; onImportMore: () => void }) {
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
          <h2 className="font-semibold">Imported {requestCount(result.requests)}</h2>
          <p className="text-sm text-muted-foreground">
            {result.payees > 0 ? `Added ${newPayeeCount(result.payees)}.` : "No new payees were needed."}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 desktop:w-auto desktop:flex-row">
          <Button className="h-11 px-5" asChild>
            <Link href={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "paid" })}>View paid requests</Link>
          </Button>
          <Button variant="outline" className="h-11 px-5" onClick={onImportMore}>
            Import more
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
