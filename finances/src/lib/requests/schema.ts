import { z } from "zod";
import { isIsoDate, todayInLA, type IsoDate } from "@/lib/dates";
import { formatCents, parseAmountToCents } from "@/lib/money";
import type { Database, Enums } from "@/lib/database.types";
import { appErrorMessage } from "./actions";
import { MAX_LINES, linesTotal, type RequestLineValues } from "./lines";

export type RequestType = Enums<"reimbursement_type">;

export const REQUEST_TYPES = ["cafe", "youth"] as const satisfies readonly RequestType[];

// Limits match the reimbursement_requests and request_lines table checks.
export const MAX_REQUEST_CENTS = 100_000_000;
export const MIN_PURCHASE_DATE: IsoDate = "2000-01-01";
export const MAX_NO_RECEIPT_REASON = 500;

/** The request's own fields, in the order they appear on screen. Each receipt has its own amount and vendor. */
export const REQUEST_FIELDS = [
  "payee_id",
  "type",
  "purchase_date",
  "description",
  "event_name",
  "no_receipt_reason",
] as const;

export type RequestField = (typeof REQUEST_FIELDS)[number];

/** What the form holds while editing. Amounts stay text until they're saved. */
export type RequestFormValues = {
  payee_id: string;
  type: RequestType | "";
  purchase_date: string;
  /** The receipts, in order. There's always at least one. */
  lines: RequestLineValues[];
  description: string;
  event_name: string;
  /** "No receipt on file", for backfilled history and lost receipts. */
  no_receipt: boolean;
  no_receipt_reason: string;
};

export type LineField = "amount" | "vendor";

export type LineErrors = Partial<Record<LineField, string>>;

/** Errors to show next to the fields. `total` is about the receipts together. */
export type RequestFieldErrors = Partial<Record<RequestField | "total", string>> & {
  /** Each receipt's errors, by its id. */
  lines?: Record<string, LineErrors>;
};

const TOO_LARGE = `Keep the amount to ${formatCents(MAX_REQUEST_CENTS)} or less.`;
const TOTAL_TOO_LARGE = `Keep the total to ${formatCents(MAX_REQUEST_CENTS)} or less.`;

/** Explains why an amount didn't parse, so the message says what to fix. */
function amountError(input: string): string {
  const cleaned = input.replace(/[$,\s]/g, "");
  const hasDigit = /\d/.test(cleaned);
  if (hasDigit && /^0*\.?0*$/.test(cleaned)) return "Enter an amount more than $0.";
  if (/^\d*\.\d{3,}$/.test(cleaned)) return "Use no more than 2 decimal places.";
  if (hasDigit && /^\d*(\.\d{0,2})?$/.test(cleaned)) return TOO_LARGE;
  return "Enter a dollar amount, like 12.34.";
}

const lineSchema = z.object({
  id: z.string(),
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
  // Recommended, not required: older payments often don't have them.
  vendor: z
    .string()
    .trim()
    .max(100, "Keep the vendor to 100 characters or fewer.")
    .transform((value) => value || null),
});

/**
 * Validates the request form and converts it to saved values. `today` is the
 * Los Angeles date that the purchase date can't be after.
 */
export function requestSchema(today: IsoDate = todayInLA()) {
  return z
    .object({
      payee_id: z.string().min(1, "Choose a payee."),
      type: z.enum(REQUEST_TYPES, "Choose Cafe or Youth."),
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
      lines: z
        .array(lineSchema)
        .min(1, "Enter an amount.")
        .max(MAX_LINES, `A request can have up to ${MAX_LINES} receipts.`)
        .transform((lines, ctx) => {
          const saved = lines.map(({ id, amount, vendor }) => ({ id, amount_cents: amount, vendor }));
          if (linesTotal(saved) > MAX_REQUEST_CENTS) {
            ctx.addIssue({ code: "custom", message: TOTAL_TOO_LARGE });
            return z.NEVER;
          }
          return saved;
        }),
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
    .transform(({ lines, no_receipt, no_receipt_reason, ...rest }) => ({
      ...rest,
      lines,
      amount_cents: linesTotal(lines),
      no_receipt,
      no_receipt_reason: (no_receipt && no_receipt_reason) || null,
    }));
}

export type RequestInput = z.output<ReturnType<typeof requestSchema>>;

/**
 * The first message for each field, ready to show next to it. `lines` is what
 * was checked, so each receipt's errors land under its id.
 */
export function requestFieldErrors(
  error: Pick<z.ZodError, "issues">,
  lines: readonly Pick<RequestLineValues, "id">[],
): RequestFieldErrors {
  const result: RequestFieldErrors = {};
  for (const issue of error.issues) {
    const [key, index, field] = issue.path;
    if (key === "lines") {
      const id = typeof index === "number" ? lines[index]?.id : undefined;
      if (id && (field === "amount" || field === "vendor")) {
        const lineErrors = (result.lines ??= {})[id] ?? {};
        lineErrors[field] ??= issue.message;
        result.lines[id] = lineErrors;
      } else if (index === undefined) {
        result.total ??= issue.message;
      }
    } else if (REQUEST_FIELDS.includes(key as RequestField)) {
      result[key as RequestField] ??= issue.message;
    }
  }
  return result;
}

/**
 * The errors still worth showing after a field changes: a change clears its
 * own. For the receipts, that's the fields that changed and any receipt taken
 * off, plus the total once an amount changes.
 */
export function errorsAfterChange<E extends RequestFieldErrors & { receipts?: string }, K extends keyof RequestFormValues>(
  errors: E,
  key: K,
  before: RequestFormValues[K],
  after: RequestFormValues[K],
): E {
  if (key === "no_receipt") return { ...errors, receipts: undefined, no_receipt_reason: undefined };
  if (key !== "lines") return { ...errors, [key]: undefined };

  const was = before as RequestLineValues[];
  const now = after as RequestLineValues[];
  const lines: Record<string, LineErrors> = {};
  for (const line of now) {
    const old = was.find((candidate) => candidate.id === line.id);
    const lineErrors = errors.lines?.[line.id];
    if (!old || !lineErrors) continue;
    const left: LineErrors = {};
    if (lineErrors.amount && old.amount === line.amount) left.amount = lineErrors.amount;
    if (lineErrors.vendor && old.vendor === line.vendor) left.vendor = lineErrors.vendor;
    if (left.amount || left.vendor) lines[line.id] = left;
  }
  // By value, so tidying "$600,000" to "600000.00" doesn't count.
  const cents = (line: RequestLineValues) => parseAmountToCents(line.amount) ?? line.amount;
  const amountsChanged = was.length !== now.length || now.some((line, index) => cents(line) !== cents(was[index]));
  return { ...errors, lines, total: amountsChanged ? undefined : errors.total };
}

type SaveRequestArgs = Database["public"]["Functions"]["save_request"]["Args"];

/** The `save_request` call for checked values. Leave out `requestId` to create a draft. */
export function saveRequestArgs(requestId: string | null, input: RequestInput): SaveRequestArgs {
  // The generated types don't know these arguments can be null. The function handles it.
  return {
    p_request_id: requestId,
    p_payee_id: input.payee_id,
    p_type: input.type,
    p_purchase_date: input.purchase_date,
    p_description: input.description,
    p_event_name: input.event_name,
    p_no_receipt: input.no_receipt,
    p_no_receipt_reason: input.no_receipt_reason,
    p_lines: input.lines,
  } as SaveRequestArgs;
}

type SaveError = { code?: string; message?: string };

const FUTURE_DATE_MESSAGE = "The purchase date can't be in the future.";

/** The database turned the purchase date down, which belongs next to the date field. */
export function isFutureDateError(error: SaveError | null): boolean {
  return error?.code === "22023" && error.message === FUTURE_DATE_MESSAGE;
}

/** A plain message for a failed request save. Raw database errors never reach the screen. */
export function requestSaveErrorMessage(error: SaveError | null): string {
  if (error?.code === "42501" || error?.code === "PGRST116") {
    // A requester hears why, like an account that isn't linked to a payee yet.
    return appErrorMessage(error) ?? "You don't have permission to save requests.";
  }
  if (error?.code === "23503") return "That payee couldn't be found. Choose the payee again.";
  return appErrorMessage(error) ?? "Couldn't save the request. Check your connection and try again.";
}
