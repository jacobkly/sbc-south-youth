import type { ReactNode } from "react";
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, monthShortName } from "@/lib/dates";
import type { ImportProblem, ImportRow } from "@/lib/import/parse";
import type { MonthTotal } from "@/lib/import/plan";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES } from "@/lib/requests/schema";

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

export function rowCount(count: number): string {
  return plural(count, "row", "rows");
}

export function requestCount(count: number): string {
  return plural(count, "request", "requests");
}

export function newPayeeCount(count: number): string {
  return plural(count, "new payee", "new payees");
}

/** One number in the summary grid. */
export function SummaryStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {note && <dd className="text-sm text-muted-foreground tabular-nums">{note}</dd>}
    </div>
  );
}

/** Rows that can't be imported yet, with everything wrong with each. */
export function ProblemList({ problems }: { problems: ImportProblem[] }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>
        {problems.length === 1 ? "1 row has a problem" : `${problems.length.toLocaleString("en-US")} rows have problems`}
      </AlertTitle>
      <AlertDescription>
        <p>Fix {problems.length === 1 ? "it" : "them"} in your spreadsheet, then paste or choose the file again.</p>
        <ul className="mt-2 max-h-72 w-full space-y-2 overflow-y-auto">
          {problems.map((problem) => (
            <li key={problem.line}>
              <span className="font-medium">Row {problem.line}:</span> {problem.messages.join(" ")}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function monthLabel(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return `${monthShortName({ kind: "month", year, month: number })} ${year}`;
}

/** Totals by month and type, to check against the spreadsheet before importing. */
export function MonthTotals({ months }: { months: MonthTotal[] }) {
  const sum = (key: "cafe" | "youth" | "total") => months.reduce((total, month) => total + month[key], 0);

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
          <caption className="sr-only">Totals by month and type</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-2 py-2 text-left font-normal">
                Month
              </th>
              {REQUEST_TYPES.map((type) => (
                <th key={type} scope="col" className="px-2 py-2 text-right font-normal">
                  {REQUEST_TYPE_LABELS[type]}
                </th>
              ))}
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
                {REQUEST_TYPES.map((type) => (
                  <td key={type} className="px-2 py-2 text-right">
                    {formatCents(month[type])}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-medium">{formatCents(month.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr>
              <th scope="row" className="px-2 py-2 text-left">
                Total
              </th>
              {REQUEST_TYPES.map((type) => (
                <td key={type} className="px-2 py-2 text-right">
                  {formatCents(sum(type))}
                </td>
              ))}
              <td className="px-2 py-2 text-right font-semibold">{formatCents(sum("total"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/** A collapsed list under a heading row, like "Show all 104 rows". */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border">
      <summary className="cursor-pointer list-none rounded-xl outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
        <span className="flex min-h-11 items-center justify-between gap-2 px-4 py-2 text-sm font-medium">
          {summary}
          <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}

/** Every row as it will be saved, under the payee it goes to. Rows already in the app are marked when they'll be skipped. */
export function RowList({
  rows,
  payeeNames,
  skipped,
}: {
  rows: ImportRow[];
  payeeNames: Map<number, string>;
  skipped: Set<number>;
}) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.line} className="space-y-1 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{payeeNames.get(row.line) ?? row.name}</span>
            <span className="shrink-0 font-medium tabular-nums">{formatCents(row.amount_cents)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Row {row.line} · {formatDate(row.date)} · {REQUEST_TYPE_LABELS[row.type]}
            </span>
            {skipped.has(row.line) && <Badge variant="outline">Skipped</Badge>}
          </div>
          {row.notes && <p className="text-sm break-words text-muted-foreground">{row.notes}</p>}
        </li>
      ))}
    </ul>
  );
}
