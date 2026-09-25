import type { SupabaseClient } from "@supabase/supabase-js";
import { daysBetween, isIsoDate, laNoon, todayInLA, type IsoDate } from "@/lib/dates";
import type { Database, Enums } from "@/lib/database.types";

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

// Limits match the reimbursement_requests table checks.
export const MAX_EXTERNAL_APPROVER = 100;
export const MAX_PAYMENT_REFERENCE = 200;

/** What the save options hold while editing. */
export type SaveOptionValues = {
  option: SaveOption;
  /** Who approved it outside the app, when it's paid to the admin entering it. */
  external_approver: string;
  payment_method: PaymentMethod;
  payment_reference: string;
  paid_date: string;
};

export type SaveOptionField = "receipts" | "external_approver" | "paid_date" | "payment_reference";

export type SaveOptionErrors = Partial<Record<SaveOptionField, string>>;

/** A save option, checked and ready to run. */
export type SaveAction =
  | { option: "draft" }
  | { option: "submit" }
  | { option: "approve"; external_approver: string | null }
  | {
      option: "paid";
      external_approver: string | null;
      payment_method: PaymentMethod;
      payment_reference: string | null;
      paid_date: IsoDate;
    };

export type SaveContext = {
  /** Los Angeles date that the paid date can't be after. */
  today: IsoDate;
  /** The form's purchase date. The paid date can't be before it. */
  purchaseDate: string;
  /** The payee is linked to the signed-in admin. */
  selfPayee: boolean;
  allowExternalApproval: boolean;
  receiptCount: number;
  noReceipt: boolean;
};

/** Approving and recording as paid both record an approval, so the self-approval rule covers both. */
function recordsApproval(option: SaveOption): boolean {
  return option === "approve" || option === "paid";
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
  option: SaveOption,
  { selfPayee, allowExternalApproval }: Pick<SaveContext, "selfPayee" | "allowExternalApproval">,
): boolean {
  return recordsApproval(option) && selfPayee && allowExternalApproval;
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
  const errors: SaveOptionErrors = {};

  if (option !== "draft" && context.receiptCount === 0 && !context.noReceipt) {
    errors.receipts = "Add a receipt, or turn on “No receipt on file” and say why.";
  }

  const approver = values.external_approver.trim();
  const approverRequired = needsExternalApprover(option, context);
  if (approverRequired && !approver) {
    errors.external_approver = "Enter who approved it.";
  } else if (approverRequired && approver.length > MAX_EXTERNAL_APPROVER) {
    errors.external_approver = `Keep the name to ${MAX_EXTERNAL_APPROVER} characters or fewer.`;
  }

  const reference = values.payment_reference.trim();
  if (option === "paid") {
    const paidDate = values.paid_date;
    const paidDateError = !paidDate
      ? "Enter the date it was paid."
      : !isIsoDate(paidDate)
        ? "Enter a valid date."
        : paidDate > context.today
          ? "The paid date can't be in the future."
          : isIsoDate(context.purchaseDate) && paidDate < context.purchaseDate
            ? "The paid date can't be before the purchase date."
            : null;
    if (paidDateError) errors.paid_date = paidDateError;

    if (reference.length > MAX_PAYMENT_REFERENCE) {
      errors.payment_reference = `Keep the reference to ${MAX_PAYMENT_REFERENCE} characters or fewer.`;
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  const externalApprover = approverRequired ? approver : null;
  switch (option) {
    case "draft":
    case "submit":
      return { success: true, data: { option } };
    case "approve":
      return { success: true, data: { option, external_approver: externalApprover } };
    case "paid":
      return {
        success: true,
        data: {
          option,
          external_approver: externalApprover,
          payment_method: values.payment_method,
          payment_reference: reference || null,
          paid_date: values.paid_date,
        },
      };
  }
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

/** Runs the status change for a saved draft. Save draft has nothing to run. */
export async function applySaveAction(
  supabase: SupabaseClient<Database>,
  requestId: string,
  action: SaveAction,
  now: Date = new Date(),
): Promise<{ message?: string; code?: string } | null> {
  switch (action.option) {
    case "draft":
      return null;
    case "submit":
      return (await supabase.rpc("submit_request", { p_request_id: requestId })).error;
    case "approve":
      return (
        await supabase.rpc("approve_request", {
          p_request_id: requestId,
          p_external_approver: action.external_approver ?? undefined,
        })
      ).error;
    case "paid":
      return (
        await supabase.rpc("record_as_paid", {
          p_request_id: requestId,
          p_method: action.payment_method,
          p_reference: action.payment_reference,
          p_paid_at: paidAtFor(action.paid_date, now),
          p_external_approver: action.external_approver ?? undefined,
        })
      ).error;
  }
}

/** Error codes the app's own database functions raise, always with a message written for people. */
const APP_ERROR_CODES = new Set(["22001", "22023", "23505", "23514", "42501", "55000", "P0002"]);

const DONE: Record<Exclude<SaveOption, "draft">, string> = {
  submit: "submitted",
  approve: "approved",
  paid: "recorded as paid",
};

/**
 * Explains a failed status change after the draft saved. The app's database
 * functions write their messages as sentences, so those are shown as is.
 * Postgres's own messages start lowercase with no period, and never reach the
 * screen.
 */
export function saveActionErrorMessage(
  option: Exclude<SaveOption, "draft">,
  error: { message?: string; code?: string } | null,
): string {
  const message = error?.message?.trim() ?? "";
  const shown =
    error?.code && APP_ERROR_CODES.has(error.code) && /^[A-Z][\s\S]*\.$/.test(message)
      ? message
      : "Check your connection and try again.";
  return `The draft is saved, but it wasn't ${DONE[option]}. ${shown}`;
}
