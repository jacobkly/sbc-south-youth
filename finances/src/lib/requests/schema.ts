import { z } from "zod";
import { isIsoDate, todayInLA, type IsoDate } from "@/lib/dates";
import { formatCents, parseAmountToCents } from "@/lib/money";
import type { Enums } from "@/lib/database.types";

export type RequestType = Enums<"reimbursement_type">;

export const REQUEST_TYPES = ["cafe", "youth"] as const satisfies readonly RequestType[];

// Limits match the reimbursement_requests table checks.
export const MAX_REQUEST_CENTS = 100_000_000;
export const MIN_PURCHASE_DATE: IsoDate = "2000-01-01";
export const MAX_NO_RECEIPT_REASON = 500;

/** The form's fields, in the order they appear on screen. */
export const REQUEST_FIELDS = [
  "payee_id",
  "type",
  "amount",
  "purchase_date",
  "vendor",
  "description",
  "event_name",
  "no_receipt_reason",
] as const;

export type RequestField = (typeof REQUEST_FIELDS)[number];

/** What the form holds while editing. The amount stays text until it's saved. */
export type RequestFormValues = {
  payee_id: string;
  type: RequestType | "";
  amount: string;
  purchase_date: string;
  vendor: string;
  description: string;
  event_name: string;
  /** "No receipt on file", for backfilled history and lost receipts. */
  no_receipt: boolean;
  no_receipt_reason: string;
};

export type RequestFieldErrors = Partial<Record<RequestField, string>>;

const TOO_LARGE = `Keep the amount to ${formatCents(MAX_REQUEST_CENTS)} or less.`;

/** Explains why an amount didn't parse, so the message says what to fix. */
function amountError(input: string): string {
  const cleaned = input.replace(/[$,\s]/g, "");
  const hasDigit = /\d/.test(cleaned);
  if (hasDigit && /^0*\.?0*$/.test(cleaned)) return "Enter an amount more than $0.";
  if (/^\d*\.\d{3,}$/.test(cleaned)) return "Use no more than 2 decimal places.";
  if (hasDigit && /^\d*(\.\d{0,2})?$/.test(cleaned)) return TOO_LARGE;
  return "Enter a dollar amount, like 12.34.";
}

/**
 * Validates the request form and converts it to insert values. `today` is the
 * Los Angeles date that the purchase date can't be after.
 */
export function requestSchema(today: IsoDate = todayInLA()) {
  return z
    .object({
      payee_id: z.string().min(1, "Choose a payee."),
      type: z.enum(REQUEST_TYPES, "Choose Cafe or Youth."),
      amount: z.string().transform((value, ctx) => {
        const trimmed = value.trim();
        const cents = trimmed ? parseAmountToCents(trimmed) : null;
        if (cents === null || cents > MAX_REQUEST_CENTS) {
          const message = !trimmed ? "Enter an amount." : cents === null ? amountError(trimmed) : TOO_LARGE;
          ctx.addIssue({ code: "custom", message });
          return z.NEVER;
        }
        return cents;
      }),
      purchase_date: z.string().superRefine((value, ctx) => {
        const message = !value
          ? "Enter the purchase date."
          : !isIsoDate(value)
            ? "Enter a valid date."
            : value < MIN_PURCHASE_DATE
              ? "Enter a date in 2000 or later."
              : value > today
                ? "The purchase date can't be in the future."
                : null;
        if (message) ctx.addIssue({ code: "custom", message });
      }),
      // Recommended, not required: older payments often don't have them.
      vendor: z
        .string()
        .trim()
        .max(100, "Keep the vendor to 100 characters or fewer.")
        .transform((value) => value || null),
      description: z
        .string()
        .trim()
        .max(1000, "Keep the description to 1,000 characters or fewer.")
        .transform((value) => value || null),
      event_name: z
        .string()
        .trim()
        .max(100, "Keep the event name to 100 characters or fewer.")
        .transform((value) => value || null),
      no_receipt: z.boolean(),
      no_receipt_reason: z
        .string()
        .trim()
        .max(MAX_NO_RECEIPT_REASON, "Keep the reason to 500 characters or fewer."),
    })
    // A reason is optional, and only makes sense with the exception turned on.
    .transform(({ amount, no_receipt, no_receipt_reason, ...rest }) => ({
      ...rest,
      amount_cents: amount,
      no_receipt,
      no_receipt_reason: (no_receipt && no_receipt_reason) || null,
    }));
}

export type RequestInput = z.output<ReturnType<typeof requestSchema>>;

/** The first message for each field, ready to show next to it. */
export function requestFieldErrors(error: Pick<z.ZodError, "issues">): RequestFieldErrors {
  const result: RequestFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (REQUEST_FIELDS.includes(key as RequestField) && !result[key as RequestField]) {
      result[key as RequestField] = issue.message;
    }
  }
  return result;
}

/** Raised by the requests guard trigger for a future purchase date. */
export const FUTURE_DATE_CODE = "22023";

/** A plain message for a failed request write. Raw database errors never reach the screen. */
export function requestSaveErrorMessage(error: { code?: string } | null): string {
  if (error?.code === FUTURE_DATE_CODE) return "The purchase date can't be in the future.";
  if (error?.code === "42501" || error?.code === "PGRST116") return "You don't have permission to save requests.";
  if (error?.code === "23503") return "That payee couldn't be found. Choose the payee again.";
  return "Couldn't save the request. Check your connection and try again.";
}
