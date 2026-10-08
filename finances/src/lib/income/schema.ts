import { z } from "zod";
import { isIsoDate, todayInLA, type IsoDate } from "@/lib/dates";
import type { Enums } from "@/lib/database.types";
import { parseAmountToCents } from "@/lib/money";
import { appErrorMessage } from "@/lib/requests/actions";
import { amountSchema, MIN_PURCHASE_DATE } from "@/lib/requests/schema";
import { FIRST_WEEK_ENDING, isWeekEnding, latestWeekEnding } from "./weeks";

export type IncomeMethod = Enums<"income_method">;
export type YouthIncomeKind = Enums<"youth_income_kind">;

export const INCOME_METHODS = ["cash_app", "zelle", "cash"] as const satisfies readonly IncomeMethod[];

export const INCOME_METHOD_LABELS: Record<IncomeMethod, string> = { cash_app: "Cash App", zelle: "Zelle", cash: "Cash" };

/** An event's money can come in more than one way, which is saved as no method. */
export const MIXED = "mixed";
export const MIXED_LABEL = "Mixed";

export const YOUTH_INCOME_KIND_LABELS: Record<YouthIncomeKind, string> = { tithe: "Tithe", event: "Event" };

/** How an entry came in, as the list shows it. */
export function incomeMethodLabel(method: IncomeMethod | null): string {
  return method ? INCOME_METHOD_LABELS[method] : MIXED_LABEL;
}

/** What the youth form holds while editing. The amount stays text until it's saved. */
export type YouthIncomeFormValues = {
  kind: YouthIncomeKind;
  amount: string;
  received_on: string;
  method: IncomeMethod | typeof MIXED | "";
  /** Only for an event, like "Bake sale". A tithe never has a name. */
  event_name: string;
};

export type YouthIncomeField = keyof YouthIncomeFormValues;

export type YouthIncomeFieldErrors = Partial<Record<YouthIncomeField, string>>;

const FUTURE_DATE_MESSAGE = "The date can't be in the future.";

/**
 * Validates the youth form and converts it to saved values. `today` is the
 * Los Angeles date the entry can't be after. Limits match the youth_income
 * table checks.
 */
export function youthIncomeSchema(today: IsoDate = todayInLA()) {
  return z
    .object({
      kind: z.enum(["tithe", "event"], "Choose Tithe or Event."),
      amount: amountSchema,
      received_on: z.string().superRefine((value, ctx) => {
        const message = !value
          ? "Enter the date."
          : !isIsoDate(value)
            ? "Enter a valid date."
            : value < MIN_PURCHASE_DATE
              ? "Enter a date in 2000 or later."
              : value > today
                ? FUTURE_DATE_MESSAGE
                : null;
        if (message) ctx.addIssue({ code: "custom", message });
      }),
      method: z.enum([...INCOME_METHODS, MIXED, ""]),
      event_name: z.string().trim().max(100, "Keep the name to 100 characters or fewer."),
    })
    .superRefine(({ kind, method }, ctx) => {
      if (kind === "tithe" ? method === "" || method === MIXED : method === "") {
        const message = kind === "tithe" ? "Choose how the tithe came in." : "Choose how the money came in.";
        ctx.addIssue({ code: "custom", path: ["method"], message });
      }
    })
    // A name typed for an event stays behind if it's switched to a tithe, so it's dropped here.
    .transform(({ kind, amount, received_on, method, event_name }) => ({
      kind,
      amount_cents: amount,
      received_on,
      method: method === MIXED || method === "" ? null : method,
      event_name: (kind === "event" && event_name) || null,
    }));
}

export type YouthIncomeInput = z.output<ReturnType<typeof youthIncomeSchema>>;

/** The first message for each field, ready to show next to it. */
export function youthIncomeFieldErrors(error: Pick<z.ZodError, "issues">): YouthIncomeFieldErrors {
  const result: YouthIncomeFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as YouthIncomeField;
    result[key] ??= issue.message;
  }
  return result;
}

/** What the cafe form holds while editing. The sales stay text until they're saved. */
export type CafeWeekFormValues = {
  /** The Sunday that ends the week. */
  week_ending: string;
  sales: string;
  note: string;
};

export type CafeWeekField = keyof CafeWeekFormValues;

export type CafeWeekFieldErrors = Partial<Record<CafeWeekField, string>>;

/**
 * Typed sales as cents, or null if they aren't an amount. Unlike other
 * amounts, $0 counts: it's a week the cafe was closed.
 */
export function parseSalesToCents(input: string): number | null {
  if (/^(0+\.?0*|\.0+)$/.test(input.replace(/[$,\s]/g, ""))) return 0;
  return parseAmountToCents(input);
}

const salesSchema = z.string().transform((value, ctx) => {
  if (parseSalesToCents(value) === 0) return 0;
  const parsed = amountSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const message = value.trim() ? parsed.error.issues[0].message : "Enter the sales, or 0 if the cafe was closed.";
  ctx.addIssue({ code: "custom", message });
  return z.NEVER;
});

/**
 * Validates the cafe form and converts it to saved values. `today` is the Los
 * Angeles date whose week is the latest that can be entered. Limits match
 * the cafe_weeks table checks.
 */
export function cafeWeekSchema(today: IsoDate = todayInLA()) {
  return z
    .object({
      week_ending: z.string().superRefine((value, ctx) => {
        const message = !isWeekEnding(value)
          ? "Choose a week."
          : value < FIRST_WEEK_ENDING
            ? "Choose a week in 2000 or later."
            : value > latestWeekEnding(today)
              ? "That week hasn't started yet."
              : null;
        if (message) ctx.addIssue({ code: "custom", message });
      }),
      sales: salesSchema,
      note: z.string().trim().max(500, "Keep the note to 500 characters or fewer."),
    })
    .transform(({ week_ending, sales, note }) => ({ week_ending, sales_cents: sales, note: note || null }));
}

export type CafeWeekInput = z.output<ReturnType<typeof cafeWeekSchema>>;

/** The first message for each field, ready to show next to it. */
export function cafeWeekFieldErrors(error: Pick<z.ZodError, "issues">): CafeWeekFieldErrors {
  const result: CafeWeekFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as CafeWeekField;
    result[key] ??= issue.message;
  }
  return result;
}

type IncomeError = { code?: string; message?: string };

/** Someone else entered the same cafe week first. */
const WEEK_TAKEN_MESSAGE = "That week already has its sales. Open it to change them.";

/** The database turned the date down, which belongs next to the date field. */
export function isIncomeDateError(error: IncomeError | null): boolean {
  return error?.code === "22023" && error.message === FUTURE_DATE_MESSAGE;
}

/**
 * An add that was already saved. The app picks each entry's id, so apart
 * from a cafe week someone else entered first, the only way an add hits a
 * duplicate is a retry after the first one went through.
 */
export function isAlreadySavedError(error: IncomeError | null): boolean {
  return error?.code === "23505" && error.message !== WEEK_TAKEN_MESSAGE;
}

const NO_PERMISSION = "You don't have permission to change income.";

/** A plain message for a failed add or edit. Raw database errors never reach the screen. */
export function incomeSaveErrorMessage(error: IncomeError | null): string {
  if (error?.code === "42501") return NO_PERMISSION;
  if (error?.code === "PGRST116") return "That entry isn't there anymore. It may have been deleted.";
  return appErrorMessage(error) ?? "Couldn't save it. Check your connection and try again.";
}

/** A plain message for a failed delete. */
export function incomeDeleteErrorMessage(error: IncomeError | null): string {
  if (error?.code === "42501") return NO_PERMISSION;
  return appErrorMessage(error) ?? "Couldn't delete it. Check your connection and try again.";
}
