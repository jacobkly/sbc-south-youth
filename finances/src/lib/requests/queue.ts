import { isIsoDate, type IsoDate } from "@/lib/dates";
import { isUuid } from "@/lib/utils";
import type { RequestStatus } from "./format";
import { REQUEST_TYPES, type RequestType } from "./schema";

export const QUEUE_TABS = ["review", "info", "pay", "paid", "closed", "all"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export const QUEUE_TAB_LABELS: Record<QueueTab, string> = {
  review: "Awaiting review",
  info: "Needs info",
  pay: "To pay",
  paid: "Paid",
  closed: "Rejected/cancelled",
  all: "All",
};

/** The statuses in each tab. All includes drafts. */
export const QUEUE_TAB_STATUSES: Record<QueueTab, readonly RequestStatus[] | null> = {
  review: ["submitted"],
  info: ["needs_info"],
  pay: ["approved"],
  paid: ["paid"],
  closed: ["rejected", "cancelled"],
  all: null,
};

export const QUEUE_PAGE_SIZE = 25;
/** Enough for 1,000 rows, the most one Supabase query returns. */
export const MAX_QUEUE_PAGES = 40;
const MAX_SEARCH = 100;

/** The queue's tab and filters, as kept in the URL. */
export type QueueFilters = {
  tab: QueueTab;
  /** Searches vendor, description, event, payee, and R-number. */
  q: string;
  /** Purchase date range, inclusive. */
  from: IsoDate | null;
  to: IsoDate | null;
  type: RequestType | null;
  payee: string | null;
  noReceipt: boolean;
  /** How many pages have been loaded with "Load more". */
  pages: number;
};

export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  tab: "pay",
  q: "",
  from: null,
  to: null,
  type: null,
  payee: null,
  noReceipt: false,
  pages: 1,
};

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the filters from the URL. Anything unrecognized falls back to its default. */
export function parseQueueFilters(params: SearchParams): QueueFilters {
  const tab = single(params, "tab");
  const type = single(params, "type");
  const from = single(params, "from");
  const to = single(params, "to");
  const payee = single(params, "payee");
  const pages = Number(single(params, "pages"));

  return {
    tab: QUEUE_TABS.find((candidate) => candidate === tab) ?? DEFAULT_QUEUE_FILTERS.tab,
    q: (single(params, "q") ?? "").trim().slice(0, MAX_SEARCH),
    from: from && isIsoDate(from) ? from : null,
    to: to && isIsoDate(to) ? to : null,
    type: REQUEST_TYPES.find((candidate) => candidate === type) ?? null,
    payee: payee && isUuid(payee) ? payee.toLowerCase() : null,
    noReceipt: single(params, "noreceipt") === "1",
    pages: Number.isInteger(pages) && pages > 1 ? Math.min(pages, MAX_QUEUE_PAGES) : 1,
  };
}

/** The queue's URL for these filters, leaving out the defaults. */
export function queueHref(filters: QueueFilters): string {
  const params = new URLSearchParams();
  if (filters.tab !== DEFAULT_QUEUE_FILTERS.tab) params.set("tab", filters.tab);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.type) params.set("type", filters.type);
  if (filters.payee) params.set("payee", filters.payee);
  if (filters.noReceipt) params.set("noreceipt", "1");
  if (filters.pages > 1) params.set("pages", String(filters.pages));
  const query = params.toString();
  return query ? `/admin/requests?${query}` : "/admin/requests";
}

/** How many filters are on, not counting the tab and search. */
export function activeFilterCount(filters: QueueFilters): number {
  return [filters.from || filters.to, filters.type, filters.payee, filters.noReceipt].filter(Boolean).length;
}

/** Whether anything narrows the results beyond the tab. */
export function isFiltered(filters: QueueFilters): boolean {
  return Boolean(filters.q) || activeFilterCount(filters) > 0;
}

/** The request number in a search like "R-0012", "r12", or "12". */
export function requestNumberIn(term: string): number | null {
  const match = /^r?-?\s*0*(\d{1,9})$/i.exec(term.trim());
  return match ? Number(match[1]) : null;
}

/** A LIKE pattern for text containing `term`, with its own % and _ taken literally. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Quotes a value for a PostgREST `or` filter, so commas, dots, and parentheses in it stay literal. */
function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, (char) => `\\${char}`)}"`;
}

/**
 * The PostgREST `or` filter for a search: the text anywhere in the vendor,
 * description, or event, one of the payees whose name matched, or the
 * request number.
 */
export function searchFilter(term: string, payeeIds: readonly string[]): string {
  const pattern = quoted(containsPattern(term.trim()));
  const clauses = ["vendor", "description", "event_name"].map((column) => `${column}.ilike.${pattern}`);
  if (payeeIds.length > 0) clauses.push(`payee_id.in.(${payeeIds.join(",")})`);
  const number = requestNumberIn(term);
  if (number !== null) clauses.push(`request_number.eq.${number}`);
  return clauses.join(",");
}
