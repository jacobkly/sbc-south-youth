import {
  addDays,
  isIsoDate,
  laMidnight,
  periodContaining,
  periodRange,
  shiftPeriod,
  type CalendarPeriod,
  type IsoDate,
  type Period,
  type PeriodKind,
} from "@/lib/dates";
import type { RequestStatus } from "@/lib/requests/format";
import { REQUEST_TYPES, type RequestType } from "@/lib/requests/schema";

export const REPORT_BASES = ["purchase", "paid"] as const;
/** Which date puts a request in the period. */
export type ReportBasis = (typeof REPORT_BASES)[number];

export const REPORT_BASIS_LABELS: Record<ReportBasis, string> = {
  purchase: "Purchase date",
  paid: "Paid date",
};

/** The statuses a report counts unless all statuses are on. */
export const REPORT_STATUSES = ["approved", "paid"] as const satisfies readonly RequestStatus[];

/** The oldest year a report can reach, so a mistyped URL can't ask for year 0. */
const MIN_YEAR = 1900;

export type CustomPeriod = Extract<Period, { kind: "custom" }>;

/** The report's period and filters, as kept in the URL. */
export type ReportFilters = {
  period: Period;
  basis: ReportBasis;
  /**
   * Every status, not just approved and paid. Only applies to purchase
   * dates, since only paid requests have a paid date.
   */
  allStatuses: boolean;
};

/** This quarter, by purchase date, approved and paid. */
export function defaultReportFilters(today: IsoDate): ReportFilters {
  return { period: periodContaining("quarter", today), basis: "purchase", allStatuses: false };
}

/** A custom range, or null unless both dates are real and in order. */
export function customPeriod(start: IsoDate, end: IsoDate): CustomPeriod | null {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return null;
  if (Number(start.slice(0, 4)) < MIN_YEAR) return null;
  return { kind: "custom", start, end };
}

/**
 * A period as the URL and export file names write it: "2026", "2026-Q3",
 * "2026-09", or "2026-03-15_to_2026-04-02".
 */
export function periodSlug(period: Period): string {
  switch (period.kind) {
    case "month":
      return `${period.year}-${String(period.month).padStart(2, "0")}`;
    case "quarter":
      return `${period.year}-Q${period.quarter}`;
    case "year":
      return String(period.year);
    case "custom":
      return `${period.start}_to_${period.end}`;
  }
}

/** Reads a period slug. Null for anything else. */
export function parsePeriodSlug(slug: string): Period | null {
  let match = /^(\d{4})$/.exec(slug);
  if (match) return calendar({ kind: "year", year: Number(match[1]) });

  match = /^(\d{4})-Q([1-4])$/i.exec(slug);
  if (match) return calendar({ kind: "quarter", year: Number(match[1]), quarter: Number(match[2]) });

  match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(slug);
  if (match) return calendar({ kind: "month", year: Number(match[1]), month: Number(match[2]) });

  match = /^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/.exec(slug);
  if (match) return customPeriod(match[1], match[2]);

  return null;
}

function calendar(period: CalendarPeriod): CalendarPeriod | null {
  return period.year >= MIN_YEAR ? period : null;
}

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the report from the URL. Anything unrecognized falls back to its default. */
export function parseReportFilters(params: SearchParams, today: IsoDate): ReportFilters {
  const defaults = defaultReportFilters(today);
  const basis = single(params, "basis");
  return {
    period: parsePeriodSlug(single(params, "period") ?? "") ?? defaults.period,
    basis: REPORT_BASES.find((candidate) => candidate === basis) ?? defaults.basis,
    allStatuses: single(params, "status") === "all",
  };
}

/** The filters as URL parameters, leaving out the default basis and status. */
function reportParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams({ period: periodSlug(filters.period) });
  if (filters.basis !== "purchase") params.set("basis", filters.basis);
  if (filters.allStatuses) params.set("status", "all");
  return params;
}

/** The report's URL for these filters. */
export function reportHref(filters: ReportFilters): string {
  return `/admin/reports?${reportParams(filters)}`;
}

/** How many of a report's requests show on each page. */
export const REPORT_PAGE_SIZE = 15;

/**
 * Which page of requests the URL shows. Kept apart from the filters, since
 * it doesn't change what the report counts or exports.
 */
export function parseReportPage(params: SearchParams): number {
  const page = Number(single(params, "page"));
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** The report's URL showing this page of requests. */
export function reportPageHref(filters: ReportFilters, page: number): string {
  const params = reportParams(filters);
  if (page > 1) params.set("page", String(page));
  return `/admin/reports?${params}`;
}

/** The files a report downloads as: one line per request, or the totals. */
export type ReportFile = "requests" | "summary";

/** Where to download the report as a CSV. */
export function reportExportHref(filters: ReportFilters, file: ReportFile = "requests"): string {
  const params = reportParams(filters);
  if (file === "summary") params.set("file", "summary");
  return `/admin/reports/export?${params}`;
}

/**
 * The period to show after switching to another kind. A month, quarter, or
 * year holds the current period's last day, or today if that comes first.
 * A custom range starts as the current period's dates.
 */
export function switchPeriodKind(period: Period, kind: PeriodKind, today: IsoDate): Period {
  const { start, end } = periodRange(period);
  if (kind === "custom") return { kind, start, end };
  return periodContaining(kind, end < today ? end : today);
}

/**
 * Where a report looks: the date column, the range [from, before) on it,
 * and the statuses it counts, or null for every status.
 */
export type ReportBounds = {
  column: "purchase_date" | "paid_at";
  from: string;
  before: string;
  statuses: readonly RequestStatus[] | null;
};

export function reportBounds(filters: ReportFilters): ReportBounds {
  const { start, end } = periodRange(filters.period);
  const after = addDays(end, 1);
  if (filters.basis === "paid") {
    // paid_at is an instant, so the range runs from midnight to midnight in LA.
    return {
      column: "paid_at",
      from: laMidnight(start).toISOString(),
      before: laMidnight(after).toISOString(),
      statuses: ["paid"],
    };
  }
  return { column: "purchase_date", from: start, before: after, statuses: filters.allStatuses ? null : REPORT_STATUSES };
}

/** Whether the next month, quarter, or year has started, so there's something to step to. */
export function canStepForward(period: CalendarPeriod, today: IsoDate): boolean {
  return periodRange(shiftPeriod(period, 1)).start <= today;
}

export type ReportAmount = { cents: number; count: number };
export type ReportTotals = ReportAmount & { byType: Record<RequestType, ReportAmount> };

/** The total and count of the report's requests, overall and by type. */
export function reportTotals(rows: readonly { type: RequestType; amount_cents: number }[]): ReportTotals {
  const totals: ReportTotals = {
    cents: 0,
    count: 0,
    byType: Object.fromEntries(REQUEST_TYPES.map((type) => [type, { cents: 0, count: 0 }])) as Record<
      RequestType,
      ReportAmount
    >,
  };
  for (const row of rows) {
    totals.cents += row.amount_cents;
    totals.count += 1;
    totals.byType[row.type].cents += row.amount_cents;
    totals.byType[row.type].count += 1;
  }
  return totals;
}

export type PayeeTotals = ReportTotals & { payeeId: string; name: string };

export type PayeeReportRow = {
  payee_id: string;
  payee: { full_name: string } | null;
  type: RequestType;
  amount_cents: number;
};

/**
 * The report's totals for each payee, biggest first and then by name.
 * Grouped by payee, not name, since two payees can share a name.
 */
export function reportPayeeTotals(rows: readonly PayeeReportRow[]): PayeeTotals[] {
  const groups = new Map<string, PayeeReportRow[]>();
  for (const row of rows) {
    const group = groups.get(row.payee_id);
    if (group) group.push(row);
    else groups.set(row.payee_id, [row]);
  }
  return Array.from(groups, ([payeeId, group]) => ({
    payeeId,
    name: group[0].payee?.full_name ?? "Unknown payee",
    ...reportTotals(group),
  })).sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
}
