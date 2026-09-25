import { toCsv, type CsvValue } from "@/lib/csv";
import { laDateTime } from "@/lib/dates";
import { centsToDecimal } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/requests/actions";
import { formatRequestNumber, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import type { ReportExportRow } from "@/lib/requests/queries";
import { periodSlug, type ReportFilters } from "./filters";

export const REPORT_CSV_HEADER = [
  "request_number",
  "status",
  "payee",
  "entered_by",
  "purchase_date",
  "vendor",
  "type",
  "description",
  "event",
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
  "no_receipt_reason",
] as const;

function instant(value: string | null): string | null {
  return value && laDateTime(value);
}

/** One request as a CSV line, in header order. Amounts are dollars and times are LA. */
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
    row.event_name,
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
    row.no_receipt_reason,
  ];
}

export function reportCsv(rows: readonly ReportExportRow[]): string {
  return toCsv(REPORT_CSV_HEADER, rows.map(reportCsvRow));
}

/**
 * The file name, like "sbc-youth-reimbursements_2026-Q3.csv". A paid-date
 * or all-statuses report says so, so it isn't mistaken for the default one.
 */
export function reportFileName(filters: ReportFilters): string {
  const parts = ["sbc-youth-reimbursements", periodSlug(filters.period)];
  if (filters.basis === "paid") parts.push("paid-date");
  else if (filters.allStatuses) parts.push("all-statuses");
  return `${parts.join("_")}.csv`;
}
