import type { Enums, Json } from "@/lib/database.types";
import { formatDate, isIsoDate, laDateOf } from "@/lib/dates";
import { formatCents } from "@/lib/money";

/**
 * How finances words a request's history, copied from finances so the
 * portal feed reads the same. Keep the two in step when either changes.
 */

export type RequestStatus = Enums<"request_status">;
export type RequestType = Enums<"reimbursement_type">;

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  cafe: "Cafe",
  youth: "Youth",
};

export type PaymentMethod = Enums<"payment_method">;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_app: "Cash App",
  bank_transfer: "Bank transfer",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

/** What a request's history records. Matches the check on `request_events.action`. */
export type RequestAction =
  | "created"
  | "updated"
  | "submitted"
  | "approved"
  | "recorded_paid"
  | "info_requested"
  | "rejected"
  | "cancelled"
  | "unapproved"
  | "paid"
  | "unpaid"
  | "receipt_added"
  | "receipt_removed"
  | "corrected";

export const REQUEST_ACTION_LABELS: Record<RequestAction, string> = {
  created: "Created",
  updated: "Edited",
  submitted: "Submitted",
  approved: "Approved",
  recorded_paid: "Recorded as paid",
  info_requested: "Asked for more info",
  rejected: "Rejected",
  cancelled: "Cancelled",
  unapproved: "Approval undone",
  paid: "Marked paid",
  unpaid: "Payment undone",
  receipt_added: "File added",
  receipt_removed: "File removed",
  corrected: "Corrected",
};

/** One request event, as its wording needs it. `action` is without the feed's "request." prefix. */
export type RequestEvent = {
  action: string;
  from_status: RequestStatus | null;
  changes: Json | null;
};

export function isRequestAction(action: string): action is RequestAction {
  return Object.hasOwn(REQUEST_ACTION_LABELS, action);
}

/** The headline for an event, e.g. "Resubmitted" after more info was requested. */
export function requestEventTitle(event: Pick<RequestEvent, "action" | "from_status">): string {
  if (event.action === "submitted" && event.from_status === "needs_info") return "Resubmitted";
  return isRequestAction(event.action) ? REQUEST_ACTION_LABELS[event.action] : event.action;
}

function isRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The file a receipt event is about. */
export function eventFilename(event: Pick<RequestEvent, "action" | "changes">): string | null {
  if (event.action !== "receipt_added" && event.action !== "receipt_removed") return null;
  const filename = isRecord(event.changes) ? event.changes.filename : null;
  return typeof filename === "string" ? filename : null;
}

/** Fields an edit can change, in the order the finances form shows them. */
const CHANGE_FIELDS = [
  ["payee_id", "Payee"],
  ["type", "Type"],
  ["amount_cents", "Amount"],
  // Each receipt's amount and vendor, when the request has had more than one.
  ["lines", "Receipts"],
  ["purchase_date", "Purchase date"],
  ["vendor", "Vendor"],
  ["description", "Description"],
  ["event_name", "Event"],
  ["no_receipt", "No receipt on file"],
  ["no_receipt_reason", "Why there's no receipt"],
  // A correction to a paid request can change its payment too.
  ["payment_method", "Paid with"],
  ["paid_at", "Date paid"],
  ["payment_reference", "Reference"],
] as const;

type ChangeField = (typeof CHANGE_FIELDS)[number][0];

export type RequestFieldChange = { field: ChangeField; label: string; from: string; to: string };

/** Payee ids named in edits, so their names can be looked up. */
export function changedPayeeIds(events: readonly Pick<RequestEvent, "action" | "changes">[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.action === "receipt_added" || event.action === "receipt_removed") continue;
    const change = isRecord(event.changes) ? event.changes.payee_id : null;
    if (!isRecord(change)) continue;
    for (const id of [change.from, change.to]) if (typeof id === "string") ids.add(id);
  }
  return [...ids];
}

/** "$10.00 Costco", or just the amount without a vendor. */
function formatLine(line: Json): string {
  if (!isRecord(line) || typeof line.amount_cents !== "number") return "?";
  return [formatCents(line.amount_cents), line.vendor].filter((part) => typeof part === "string" && part).join(" ");
}

function formatValue(field: ChangeField, value: Json | undefined, payeeNames: ReadonlyMap<string, string>): string {
  if (value === null || value === undefined || value === "") return "None";
  switch (field) {
    case "payee_id":
      return (typeof value === "string" && payeeNames.get(value)) || "Unknown payee";
    case "type":
      return value === "cafe" || value === "youth" ? REQUEST_TYPE_LABELS[value] : String(value);
    case "amount_cents":
      return typeof value === "number" ? formatCents(value) : String(value);
    case "purchase_date":
      return typeof value === "string" && isIsoDate(value) ? formatDate(value) : String(value);
    case "no_receipt":
      return value === true ? "On" : "Off";
    case "payment_method":
      return typeof value === "string" && Object.hasOwn(PAYMENT_METHOD_LABELS, value)
        ? PAYMENT_METHOD_LABELS[value as PaymentMethod]
        : String(value);
    case "paid_at":
      return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? formatDate(laDateOf(value)) : String(value);
    case "lines":
      return Array.isArray(value) && value.length > 0 ? value.map(formatLine).join(", ") : "None";
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

/** The before and after of each field an edit changed, ready to show. */
export function describeRequestChanges(
  event: Pick<RequestEvent, "action" | "changes">,
  payeeNames: ReadonlyMap<string, string> = new Map(),
): RequestFieldChange[] {
  if (event.action === "receipt_added" || event.action === "receipt_removed") return [];
  const { changes } = event;
  if (!isRecord(changes)) return [];

  return CHANGE_FIELDS.flatMap(([field, label]) => {
    const change = changes[field];
    if (!isRecord(change)) return [];
    return [
      {
        field,
        label,
        from: formatValue(field, change.from, payeeNames),
        to: formatValue(field, change.to, payeeNames),
      },
    ];
  });
}

/**
 * What a list calls a request: the vendor, else what was bought, else its
 * type, since the vendor and description are optional.
 */
export function requestTitle(request: {
  vendor: string | null;
  description: string | null;
  type: RequestType;
}): string {
  return request.vendor ?? request.description ?? `${REQUEST_TYPE_LABELS[request.type]} purchase`;
}

/** The number people see, e.g. 7 -> "R-0007". */
export function formatRequestNumber(requestNumber: number): string {
  return `R-${String(requestNumber).padStart(4, "0")}`;
}
