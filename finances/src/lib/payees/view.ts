import { PAYEE_SORTS, type PayeeSort } from "./sort";

export const PAYEE_STATUSES = ["active", "inactive"] as const;
export type PayeeStatus = (typeof PAYEE_STATUSES)[number];

/** What the payees list shows, as kept in the URL so the back button brings it back. */
export type PayeeView = {
  sort: PayeeSort;
  /** Which tab is open. */
  status: PayeeStatus;
  /** Searches name, email, and payment handle. */
  q: string;
};

export const DEFAULT_PAYEE_VIEW: PayeeView = { sort: "name", status: "active", q: "" };

const MAX_SEARCH = 100;

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the view from the URL. Anything unrecognized falls back to its default. */
export function parsePayeeView(params: SearchParams): PayeeView {
  const sort = single(params, "sort");
  const status = single(params, "status");
  return {
    sort: PAYEE_SORTS.find((candidate) => candidate === sort) ?? DEFAULT_PAYEE_VIEW.sort,
    status: PAYEE_STATUSES.find((candidate) => candidate === status) ?? DEFAULT_PAYEE_VIEW.status,
    q: (single(params, "q") ?? "").trim().slice(0, MAX_SEARCH),
  };
}

/** The payees list's URL for this view, leaving out the defaults. */
export function payeesHref(view: PayeeView): string {
  const params = new URLSearchParams();
  if (view.sort !== DEFAULT_PAYEE_VIEW.sort) params.set("sort", view.sort);
  if (view.status !== DEFAULT_PAYEE_VIEW.status) params.set("status", view.status);
  if (view.q.trim()) params.set("q", view.q.trim());
  const query = params.toString();
  return query ? `/admin/payees?${query}` : "/admin/payees";
}
