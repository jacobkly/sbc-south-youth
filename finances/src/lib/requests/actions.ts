import type { SupabaseClient } from "@supabase/supabase-js";
import { daysBetween, isIsoDate, laNoon, todayInLA, type IsoDate } from "@/lib/dates";
import type { Database, Enums } from "@/lib/database.types";
import type { RequestStatus } from "./format";

/** What happens to a new request after its draft is saved. */
export type SaveOption = "draft" | "submit" | "approve" | "paid";

export const SAVE_OPTIONS = ["draft", "submit", "approve", "paid"] as const satisfies readonly SaveOption[];

export const SAVE_OPTION_LABELS: Record<SaveOption, string> = {
  draft: "Save draft",
  submit: "Submit",
  approve: "Approve",
  paid: "Record as paid",
};

export type PaymentMethod = Enums<"payment_method">;

export const PAYMENT_METHODS = [
  "cash_app",
  "bank_transfer",
  "check",
  "cash",
  "other",
] as const satisfies readonly PaymentMethod[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_app: "Cash App",
  bank_transfer: "Bank transfer",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

// Limits match the reimbursement_requests table checks and the status functions.
export const MAX_EXTERNAL_APPROVER = 100;
export const MAX_PAYMENT_REFERENCE = 200;
export const MAX_NOTE = 1000;

/** How a payment is recorded, whether saving a new request or marking a saved one paid. */
export type PaymentValues = {
  payment_method: PaymentMethod;
  payment_reference: string;
  paid_date: string;
};

/** A payment, checked and ready to record. */
export type Payment = {
  payment_method: PaymentMethod;
  payment_reference: string | null;
  paid_date: IsoDate;
};

/** What the save options hold while editing. */
export type SaveOptionValues = PaymentValues & {
  option: SaveOption;
  /** Who approved it outside the app, when it's paid to the admin entering it. */
  external_approver: string;
};

export type SaveOptionField = "receipts" | "external_approver" | "paid_date" | "payment_reference";

export type SaveOptionErrors = Partial<Record<SaveOptionField, string>>;

/** A save option, checked and ready to run. */
export type SaveAction =
  | { option: "draft" }
  | { option: "submit" }
  | { option: "approve"; external_approver: string | null }
  | ({ option: "paid"; external_approver: string | null } & Payment);

export type SaveContext = {
  /** Los Angeles date that the paid date can't be after. */
  today: IsoDate;
  /** The request's purchase date. The paid date can't be before it. */
  purchaseDate: string;
  /** The payee is linked to the signed-in admin. */
  selfPayee: boolean;
  allowExternalApproval: boolean;
  receiptCount: number;
  noReceipt: boolean;
};

/** A status change on a saved request. */
export type RequestAction =
  | "submit"
  | "approve"
  | "record_paid"
  | "request_info"
  | "reject"
  | "cancel"
  | "unapprove"
  | "mark_paid"
  | "unmark_paid";

/** Actions that need a note saying why. The note is kept in the request's history. */
export type NoteAction = Extract<RequestAction, "request_info" | "reject" | "unapprove" | "unmark_paid">;

/** Approving and recording as paid both record an approval, so the self-approval rule covers both. */
function recordsApproval(action: SaveOption | RequestAction): boolean {
  return action === "approve" || action === "paid" || action === "record_paid";
}

/**
 * The options open for this payee. An admin can't approve their own
 * reimbursement while external approval is off; another admin has to.
 */
export function availableSaveOptions({
  selfPayee,
  allowExternalApproval,
}: Pick<SaveContext, "selfPayee" | "allowExternalApproval">): SaveOption[] {
  if (selfPayee && !allowExternalApproval) return SAVE_OPTIONS.filter((option) => !recordsApproval(option));
  return [...SAVE_OPTIONS];
}

/** "Approved by" is needed when an admin approves a reimbursement paid to them. */
export function needsExternalApprover(
  action: SaveOption | RequestAction,
  { selfPayee, allowExternalApproval }: Pick<SaveContext, "selfPayee" | "allowExternalApproval">,
): boolean {
  return recordsApproval(action) && selfPayee && allowExternalApproval;
}

const RECEIPT_REQUIRED = "Add a receipt, or turn on “No receipt on file” and say why.";

function missingReceipt({ receiptCount, noReceipt }: Pick<SaveContext, "receiptCount" | "noReceipt">): boolean {
  return receiptCount === 0 && !noReceipt;
}

function approverError(approver: string): string | undefined {
  if (!approver) return "Enter who approved it.";
  if (approver.length > MAX_EXTERNAL_APPROVER) return `Keep the name to ${MAX_EXTERNAL_APPROVER} characters or fewer.`;
  return undefined;
}

/** Checks a payment's date and reference. The paid date can't be in the future or before the purchase. */
function checkPayment(
  values: PaymentValues,
  { today, purchaseDate }: Pick<SaveContext, "today" | "purchaseDate">,
): { payment: Payment; errors: Partial<Record<"paid_date" | "payment_reference", string>> } {
  const errors: Partial<Record<"paid_date" | "payment_reference", string>> = {};
  const paidDate = values.paid_date;
  const paidDateError = !paidDate
    ? "Enter the date it was paid."
    : !isIsoDate(paidDate)
      ? "Enter a valid date."
      : paidDate > today
        ? "The paid date can't be in the future."
        : isIsoDate(purchaseDate) && paidDate < purchaseDate
          ? "The paid date can't be before the purchase date."
          : null;
  if (paidDateError) errors.paid_date = paidDateError;

  const reference = values.payment_reference.trim();
  if (reference.length > MAX_PAYMENT_REFERENCE) {
    errors.payment_reference = `Keep the reference to ${MAX_PAYMENT_REFERENCE} characters or fewer.`;
  }

  return {
    payment: { payment_method: values.payment_method, payment_reference: reference || null, paid_date: paidDate },
    errors,
  };
}

/**
 * Checks the chosen save option against the rest of the form. These mirror the
 * database rules, so mistakes show up next to the fields before anything is
 * saved. The status functions check them again.
 */
export function validateSaveOption(
  values: SaveOptionValues,
  context: SaveContext,
): { success: true; data: SaveAction } | { success: false; errors: SaveOptionErrors } {
  const { option } = values;
  let errors: SaveOptionErrors = {};

  if (option !== "draft" && missingReceipt(context)) errors.receipts = RECEIPT_REQUIRED;

  const approver = values.external_approver.trim();
  const approverRequired = needsExternalApprover(option, context);
  if (approverRequired) errors.external_approver = approverError(approver);

  const { payment, errors: paymentErrors } = checkPayment(values, context);
  if (option === "paid") errors = { ...errors, ...paymentErrors };

  errors = withoutBlanks(errors);
  if (Object.keys(errors).length > 0) return { success: false, errors };

  const externalApprover = approverRequired ? approver : null;
  switch (option) {
    case "draft":
    case "submit":
      return { success: true, data: { option } };
    case "approve":
      return { success: true, data: { option, external_approver: externalApprover } };
    case "paid":
      return { success: true, data: { option, external_approver: externalApprover, ...payment } };
  }
}

function withoutBlanks<T extends Record<string, string | undefined>>(errors: T): T {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as T;
}

/**
 * When it was paid. Paid today means now. An earlier date means noon that
 * day in Los Angeles, so it lands on the right day in every report.
 */
export function paidAtFor(paidDate: IsoDate, now: Date = new Date()): string {
  return (paidDate === todayInLA(now) ? now : laNoon(paidDate)).toISOString();
}

/**
 * Days since the purchase when that's past the late-submission limit, else
 * null. It's only a warning; late requests can still be saved.
 */
export function lateSubmissionDays(purchaseDate: string, today: IsoDate, limitDays: number): number | null {
  if (!isIsoDate(purchaseDate) || purchaseDate > today) return null;
  const days = daysBetween(purchaseDate, today);
  return days > limitDays ? days : null;
}

type RpcError = { message?: string; code?: string };

/** Runs the status change for a saved draft. Save draft has nothing to run. */
export async function applySaveAction(
  supabase: SupabaseClient<Database>,
  requestId: string,
  action: SaveAction,
  now: Date = new Date(),
): Promise<RpcError | null> {
  switch (action.option) {
    case "draft":
      return null;
    case "submit":
      return applyRequestAction(supabase, requestId, { action: "submit" }, now);
    case "approve":
      return applyRequestAction(
        supabase,
        requestId,
        { action: "approve", external_approver: action.external_approver },
        now,
      );
    case "paid":
      return applyRequestAction(
        supabase,
        requestId,
        {
          action: "record_paid",
          external_approver: action.external_approver,
          payment_method: action.payment_method,
          payment_reference: action.payment_reference,
          paid_date: action.paid_date,
        },
        now,
      );
  }
}

/** Each status's next steps, in the order they're offered. Rejected and cancelled are final. */
const STATUS_ACTIONS: Record<RequestStatus, readonly RequestAction[]> = {
  draft: ["submit", "approve", "record_paid"],
  submitted: ["approve", "request_info", "reject", "cancel"],
  needs_info: ["submit", "reject", "cancel"],
  approved: ["mark_paid", "unapprove"],
  paid: ["unmark_paid"],
  rejected: [],
  cancelled: [],
};

export type RequestActionContext = {
  status: RequestStatus;
  /** The payee is linked to the signed-in admin. */
  selfPayee: boolean;
  /** The signed-in admin entered the request. */
  enteredBySelf: boolean;
  allowExternalApproval: boolean;
};

/**
 * The status changes an admin can make from here. Cancelling is for the admin
 * who entered it or the payee; anyone else rejects it instead. An admin can't
 * approve their own reimbursement while external approval is off.
 */
export function availableActions({
  status,
  selfPayee,
  enteredBySelf,
  allowExternalApproval,
}: RequestActionContext): RequestAction[] {
  return STATUS_ACTIONS[status].filter((action) => {
    if (action === "cancel") return selfPayee || enteredBySelf;
    if (recordsApproval(action)) return !selfPayee || allowExternalApproval;
    return true;
  });
}

export function isNoteAction(action: RequestAction): action is NoteAction {
  return action === "request_info" || action === "reject" || action === "unapprove" || action === "unmark_paid";
}

export function recordsPayment(action: RequestAction): action is "mark_paid" | "record_paid" {
  return action === "mark_paid" || action === "record_paid";
}

/** Sending a request on needs a receipt, or the no-receipt exception with a reason. */
export function blockedByReceiptRule(
  action: RequestAction,
  context: Pick<SaveContext, "receiptCount" | "noReceipt">,
): boolean {
  return (action === "submit" || action === "approve" || action === "record_paid") && missingReceipt(context);
}

/** What an action's dialog holds while it's open. Each action uses only the fields it needs. */
export type RequestActionValues = PaymentValues & {
  note: string;
  external_approver: string;
};

export type RequestActionField = "receipts" | "note" | "external_approver" | "paid_date" | "payment_reference";

export type RequestActionErrors = Partial<Record<RequestActionField, string>>;

/** A status change, checked and ready to run. */
export type RequestActionInput =
  | { action: "submit" | "cancel" }
  | { action: "approve"; external_approver: string | null }
  | { action: NoteAction; note: string }
  | ({ action: "mark_paid" } & Payment)
  | ({ action: "record_paid"; external_approver: string | null } & Payment);

/** Checks an action's fields the way the status functions will. */
export function validateRequestAction(
  action: RequestAction,
  values: RequestActionValues,
  context: SaveContext,
): { success: true; data: RequestActionInput } | { success: false; errors: RequestActionErrors } {
  let errors: RequestActionErrors = {};

  if (blockedByReceiptRule(action, context)) errors.receipts = RECEIPT_REQUIRED;

  const note = values.note.trim();
  if (isNoteAction(action)) {
    errors.note = !note
      ? "Add a note saying why."
      : note.length > MAX_NOTE
        ? `Keep the note to ${MAX_NOTE.toLocaleString("en-US")} characters or fewer.`
        : undefined;
  }

  const approver = values.external_approver.trim();
  const approverRequired = needsExternalApprover(action, context);
  if (approverRequired) errors.external_approver = approverError(approver);

  const { payment, errors: paymentErrors } = checkPayment(values, context);
  if (recordsPayment(action)) errors = { ...errors, ...paymentErrors };

  errors = withoutBlanks(errors);
  if (Object.keys(errors).length > 0) return { success: false, errors };

  const externalApprover = approverRequired ? approver : null;
  if (isNoteAction(action)) return { success: true, data: { action, note } };
  switch (action) {
    case "submit":
    case "cancel":
      return { success: true, data: { action } };
    case "approve":
      return { success: true, data: { action, external_approver: externalApprover } };
    case "mark_paid":
      return { success: true, data: { action, ...payment } };
    case "record_paid":
      return { success: true, data: { action, external_approver: externalApprover, ...payment } };
  }
}

/** Runs a status change through its database function and returns the error, if any. */
export async function applyRequestAction(
  supabase: SupabaseClient<Database>,
  requestId: string,
  input: RequestActionInput,
  now: Date = new Date(),
): Promise<RpcError | null> {
  const p_request_id = requestId;
  switch (input.action) {
    case "submit":
      return (await supabase.rpc("submit_request", { p_request_id })).error;
    case "approve":
      return (
        await supabase.rpc("approve_request", {
          p_request_id,
          p_external_approver: input.external_approver ?? undefined,
        })
      ).error;
    case "record_paid":
      return (
        await supabase.rpc("record_as_paid", {
          p_request_id,
          p_method: input.payment_method,
          p_reference: input.payment_reference,
          p_paid_at: paidAtFor(input.paid_date, now),
          p_external_approver: input.external_approver ?? undefined,
        })
      ).error;
    case "mark_paid":
      return (
        await supabase.rpc("mark_paid", {
          p_request_id,
          p_method: input.payment_method,
          p_reference: input.payment_reference ?? undefined,
          p_paid_at: paidAtFor(input.paid_date, now),
        })
      ).error;
    case "request_info":
      return (await supabase.rpc("request_info", { p_request_id, p_note: input.note })).error;
    case "reject":
      return (await supabase.rpc("reject_request", { p_request_id, p_note: input.note })).error;
    case "cancel":
      return (await supabase.rpc("cancel_request", { p_request_id })).error;
    case "unapprove":
      return (await supabase.rpc("unapprove_request", { p_request_id, p_note: input.note })).error;
    case "unmark_paid":
      return (await supabase.rpc("unmark_paid", { p_request_id, p_note: input.note })).error;
  }
}

/** Error codes the app's own database functions raise, always with a message written for people. */
const APP_ERROR_CODES = new Set(["22001", "22023", "23505", "23514", "42501", "55000", "P0002"]);

/** Shown when a change fails for a reason people can't act on, which is usually the connection. */
export const RETRY_MESSAGE = "Check your connection and try again.";

/**
 * The app's database functions write their messages as sentences, so those
 * are shown as is. Postgres's own messages start lowercase with no period, and
 * never reach the screen.
 */
export function appErrorMessage(error: RpcError | null): string | null {
  const message = error?.message?.trim() ?? "";
  return error?.code && APP_ERROR_CODES.has(error.code) && /^[A-Z][\s\S]*\.$/.test(message) ? message : null;
}

/** The request changed since the page loaded, like someone else acting on it first. */
export function isWrongStatusError(error: RpcError | null): boolean {
  return error?.code === "55000";
}

const DONE: Record<Exclude<SaveOption, "draft">, string> = {
  submit: "submitted",
  approve: "approved",
  paid: "recorded as paid",
};

/** Explains a failed status change after the draft saved. */
export function saveActionErrorMessage(option: Exclude<SaveOption, "draft">, error: RpcError | null): string {
  return `The draft is saved, but it wasn't ${DONE[option]}. ${appErrorMessage(error) ?? RETRY_MESSAGE}`;
}
