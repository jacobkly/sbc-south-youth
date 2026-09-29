import { formatDate, isIsoDate, laDateOf, type IsoDate } from "@/lib/dates";
import type { Json } from "@/lib/database.types";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS, type RequestStatus } from "./format";

/** What the audit log records. Matches the check on `request_events.action`. */
export type EventAction =
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
  | "receipt_removed";

export const EVENT_ACTION_LABELS: Record<EventAction, string> = {
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
};

/** One row of the audit log, as the timeline needs it. */
export type RequestEvent = {
  action: string;
  from_status: RequestStatus | null;
  note: string | null;
  changes: Json | null;
  created_at: string;
};

function isEventAction(action: string): action is EventAction {
  return Object.hasOwn(EVENT_ACTION_LABELS, action);
}

/** The headline for an event, e.g. "Resubmitted" after more info was requested. */
export function eventTitle(event: Pick<RequestEvent, "action" | "from_status">): string {
  if (event.action === "submitted" && event.from_status === "needs_info") return "Resubmitted";
  return isEventAction(event.action) ? EVENT_ACTION_LABELS[event.action] : event.action;
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

/** Fields an edit can change, in the order the form shows them. */
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
] as const;

type ChangeField = (typeof CHANGE_FIELDS)[number][0];

export type FieldChange = { field: ChangeField; label: string; from: string; to: string };

/** Payee ids named in edits, so their names can be looked up. */
export function changedPayeeIds(events: Pick<RequestEvent, "action" | "changes">[]): string[] {
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
    case "lines":
      return Array.isArray(value) && value.length > 0 ? value.map(formatLine).join(", ") : "None";
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

/** The before and after of each field an edit changed, ready to show. */
export function describeChanges(
  event: Pick<RequestEvent, "action" | "changes">,
  payeeNames: ReadonlyMap<string, string> = new Map(),
): FieldChange[] {
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
 * The date the late-submission warning measures to: when the request was
 * first sent for review, or today while it's still a draft. Returns null
 * when there's nothing to warn about. Requests recorded as paid are
 * backfilled history, and a draft that was cancelled was never sent.
 *
 * `events` must be oldest first.
 */
export function lateCheckDate(
  status: RequestStatus,
  events: Pick<RequestEvent, "action" | "created_at">[],
  today: IsoDate,
): { date: IsoDate; sent: boolean } | null {
  if (events.some((event) => event.action === "recorded_paid")) return null;
  const sent = events.find((event) => event.action === "submitted" || event.action === "approved");
  if (sent) return { date: laDateOf(sent.created_at), sent: true };
  return status === "draft" ? { date: today, sent: false } : null;
}
