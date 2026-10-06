import { toCsv, type CsvValue } from "@/lib/csv";
import { laDateTime } from "@/lib/dates";
import { incomeMethodLabel, YOUTH_INCOME_KIND_LABELS } from "@/lib/income/schema";
import { centsToDecimal } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/requests/actions";
import { formatRequestNumber, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import type { ReportExportRow } from "@/lib/requests/queries";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import { tagsOf } from "@/lib/tags/tags";
import {
  periodSlug,
  reportPayeeTotals,
  reportTotals,
  type PayeeReportRow,
  type ReportFilters,
  type ReportTotals,
} from "./filters";
import type { ReportIncome } from "./income";

export const REPORT_CSV_HEADER = [
  "request_number",
  "status",
  "payee",
  "entered_by",
  "purchase_date",
  "vendor",
  "type",
  "description",
  "tags",
  "amount",
  "submitted_at",
  "approved_by",
  "external_approver",
  "approved_at",
  "paid_by",
  "paid_at",
  "payment_method",
  "payment_reference",
  "receipt_count",
  "no_receipt",
  "no_receipt_reason",
] as const;

function instant(value: string | null): string | null {
  return value && laDateTime(value);
}

/**
 * One request as a CSV line, in header order. Amounts are dollars, times are
 * LA, and tags are split by semicolons, since a tag's name can have a comma.
 */
export function reportCsvRow(row: ReportExportRow): CsvValue[] {
  return [
    formatRequestNumber(row.request_number),
    REQUEST_STATUS_LABELS[row.status],
    row.payee?.full_name,
    row.entered_by?.full_name,
    row.purchase_date,
    row.vendor,
    REQUEST_TYPE_LABELS[row.type],
    row.description,
    tagsOf(row.tags)
      .map((tag) => tag.name)
      .join("; ") || null,
    centsToDecimal(row.amount_cents),
    instant(row.submitted_at),
    row.approver?.full_name,
    row.external_approver,
    instant(row.approved_at),
    row.payer?.full_name,
    instant(row.paid_at),
    row.payment_method && PAYMENT_METHOD_LABELS[row.payment_method],
    row.payment_reference,
    row.receipts[0]?.count ?? 0,
    row.no_receipt ? "Yes" : "No",
    row.no_receipt_reason,
  ];
}

export function reportCsv(rows: readonly ReportExportRow[]): string {
  return toCsv(REPORT_CSV_HEADER, rows.map(reportCsvRow));
}

/** The summary's columns: the amount and count of each type, then in all. */
export const SUMMARY_CSV_HEADER = [
  "payee",
  ...REQUEST_TYPES.flatMap((type) => [`${type}_amount`, `${type}_count`]),
  "total_amount",
  "total_count",
];

function summaryCsvRow(name: string, totals: ReportTotals): CsvValue[] {
  return [
    name,
    ...REQUEST_TYPES.flatMap((type) => [centsToDecimal(totals.byType[type].cents), totals.byType[type].count]),
    centsToDecimal(totals.cents),
    totals.count,
  ];
}

/** One line per payee, biggest first, then an "All payees" line with the report's totals. */
export function summaryCsv(rows: readonly PayeeReportRow[]): string {
  return toCsv(SUMMARY_CSV_HEADER, [
    ...reportPayeeTotals(rows).map((payee) => summaryCsvRow(payee.name, payee)),
    summaryCsvRow("All payees", reportTotals(rows)),
  ]);
}

/**
 * The income file's columns. A cafe week's date is the Sunday it ends, which
 * is where the Income page counts it. Who gave is never recorded, so no
 * line has a name.
 */
export const INCOME_CSV_HEADER = ["date", "source", "kind", "event", "method", "amount", "note"] as const;

/**
 * One line per tithe, event, and cafe week, oldest first. A youth entry comes
 * before a cafe week on the same day.
 */
export function incomeCsv({ youth, weeks }: ReportIncome): string {
  const lines: { date: string; values: CsvValue[] }[] = [
    ...youth.map((entry) => ({
      date: entry.received_on,
      values: [
        entry.received_on,
        REQUEST_TYPE_LABELS.youth,
        YOUTH_INCOME_KIND_LABELS[entry.kind],
        entry.event_name,
        incomeMethodLabel(entry.method),
        centsToDecimal(entry.amount_cents),
        null,
      ],
    })),
    ...weeks.map((week) => ({
      date: week.week_ending,
      values: [
        week.week_ending,
        REQUEST_TYPE_LABELS.cafe,
        "Cafe week",
        null,
        null,
        centsToDecimal(week.sales_cents),
        week.note,
      ],
    })),
  ];
  // Sorting keeps ties in order, so each day's youth entries stay ahead of its cafe week.
  lines.sort((a, b) => a.date.localeCompare(b.date));
  return toCsv(INCOME_CSV_HEADER, lines.map((line) => line.values));
}

/**
 * The start of every download's name, like "sbc-youth-reimbursements_2026-Q3".
 * A paid-date or all-statuses report says so, so it isn't mistaken for the
 * default one.
 */
function fileStem(filters: ReportFilters): string {
  const parts = ["sbc-youth-reimbursements", periodSlug(filters.period)];
  if (filters.basis === "paid") parts.push("paid-date");
  else if (filters.allStatuses) parts.push("all-statuses");
  return parts.join("_");
}

/** The requests CSV's name, like "sbc-youth-reimbursements_2026-Q3.csv". */
export function reportFileName(filters: ReportFilters): string {
  return `${fileStem(filters)}.csv`;
}

/** The summary CSV's name, like "sbc-youth-reimbursements_2026-Q3_summary.csv". */
export function summaryFileName(filters: ReportFilters): string {
  return `${fileStem(filters)}_summary.csv`;
}

/** The receipts ZIP's name, like "sbc-youth-reimbursements_2026-Q3_receipts.zip". */
export function receiptsZipFileName(filters: ReportFilters): string {
  return `${fileStem(filters)}_receipts.zip`;
}

/** The income CSV's name, like "sbc-youth-income_2026-Q3.csv". The basis and statuses don't change it. */
export function incomeFileName(filters: ReportFilters): string {
  return `sbc-youth-income_${periodSlug(filters.period)}.csv`;
}
