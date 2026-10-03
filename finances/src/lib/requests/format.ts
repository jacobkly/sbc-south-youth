import type { Enums } from "@/lib/database.types";
import { laDateOf, type IsoDate } from "@/lib/dates";
import type { RequestType } from "./schema";

export type RequestStatus = Enums<"request_status">;

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  cafe: "Cafe",
  youth: "Youth",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  needs_info: "Needs info",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** A request can be edited until it's approved or closed. The database enforces the same. */
export const EDITABLE_STATUSES = ["draft", "submitted", "needs_info"] as const satisfies readonly RequestStatus[];

export function isEditable(status: RequestStatus): boolean {
  return (EDITABLE_STATUSES as readonly RequestStatus[]).includes(status);
}

/**
 * A requester edits their draft, or answers a question about it. Once it's
 * waiting on review it's locked, so it can't change while being checked.
 */
export const REQUESTER_EDITABLE_STATUSES = ["draft", "needs_info"] as const satisfies readonly RequestStatus[];

export function isEditableByRequester(status: RequestStatus): boolean {
  return (REQUESTER_EDITABLE_STATUSES as readonly RequestStatus[]).includes(status);
}

/**
 * What a list calls a request: the vendor, else what was bought, else its
 * type, since the vendor and description are optional.
 */
export function requestTitle(request: { vendor: string | null; description: string | null; type: RequestType }): string {
  return request.vendor ?? request.description ?? `${REQUEST_TYPE_LABELS[request.type]} purchase`;
}

/** The number people see, e.g. 7 -> "R-0007". */
export function formatRequestNumber(requestNumber: number): string {
  return `R-${String(requestNumber).padStart(4, "0")}`;
}

/**
 * The day a list goes by for a request: when it was paid back, or when it was
 * created while it's unpaid.
 */
export function listedDate(request: { paid_at: string | null; sort_at: string }): {
  label: "Paid" | "Created";
  date: IsoDate;
} {
  return { label: request.paid_at ? "Paid" : "Created", date: laDateOf(request.sort_at) };
}
