import type { Database, Json } from "@/lib/database.types";
import { addDays, formatDate, formatDateRange, isIsoDate, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";

/**
 * Youth income and cafe weeks, as the feed names them. Finances words them
 * the same way in its own Activity.
 */

type IncomeMethod = Database["public"]["Enums"]["income_method"];
type YouthIncomeKind = Database["public"]["Enums"]["youth_income_kind"];

export const INCOME_METHOD_LABELS: Record<IncomeMethod, string> = { cash_app: "Cash App", zelle: "Zelle", cash: "Cash" };
/** A youth entry with no method came in more than one way. */
export const MIXED_LABEL = "Mixed";
export const YOUTH_KIND_LABELS: Record<YouthIncomeKind, string> = { tithe: "Tithe", event: "Event" };

/** The income tables whose changes the feed shows, as the activity log names them. */
export const INCOME_ENTITY_TYPES = ["youth_income", "cafe_week"] as const;

export type YouthIncomeEntry = {
  kind: YouthIncomeKind;
  received_on: IsoDate;
  amount_cents: number;
  method: IncomeMethod | null;
  event_name: string | null;
};

export type CafeWeekFields = { week_ending: IsoDate; sales_cents: number; note: string | null };

/** What a change was about, as it is now or, once deleted, as it was then. */
export type IncomeSubject =
  | { type: "youth_income"; entry: YouthIncomeEntry; deleted: boolean }
  | { type: "cafe_week"; week: CafeWeekFields; deleted: boolean };

/** What the feed's rows have that naming an entry needs. */
export type IncomeRow = { action: string; entity_type: string; entity_id: string | null; changes: Json | null };

type JsonRecord = { [key: string]: Json | undefined };

function isRecord(value: Json | null | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIncomeMethod(value: Json | undefined): value is IncomeMethod {
  return typeof value === "string" && Object.hasOwn(INCOME_METHOD_LABELS, value);
}

function isDate(value: Json | undefined): value is IsoDate {
  return typeof value === "string" && isIsoDate(value);
}

export function isIncomeType(entityType: string): boolean {
  return INCOME_ENTITY_TYPES.some((type) => type === entityType);
}

/**
 * A Monday-to-Sunday week by its Sunday: "Sep 21–27" or "Sep 28 – Oct 4",
 * with the year unless it's `today`'s. Without `today`, the year always shows.
 */
export function weekLabel(weekEnding: IsoDate, today?: IsoDate): string {
  const start = addDays(weekEnding, -6);
  const year = weekEnding.slice(0, 4);
  if (start.slice(0, 4) !== year) return `${formatDate(start)} – ${formatDate(weekEnding)}`;
  const label = formatDateRange(start, weekEnding);
  return year === today?.slice(0, 4) ? label : `${label}, ${year}`;
}

/** "Oct 4", or "Dec 28, 2025" from another year. */
function shortDate(date: IsoDate, today: IsoDate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? formatDateRange(date, date) : formatDate(date);
}

/** "$25.00 · Cash App · Oct 4", "Bake sale · $340.00 · Mixed · Oct 4", or "Sep 28 – Oct 4 · $650.00". */
export function incomeLine(subject: IncomeSubject | undefined, today: IsoDate): string {
  if (!subject) return "An entry that's gone";
  if (subject.type === "cafe_week") {
    return `${weekLabel(subject.week.week_ending, today)} · ${formatCents(subject.week.sales_cents)}`;
  }
  const { entry } = subject;
  return [
    entry.kind === "event" ? entry.event_name : null,
    formatCents(entry.amount_cents),
    entry.method ? INCOME_METHOD_LABELS[entry.method] : MIXED_LABEL,
    shortDate(entry.received_on, today),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The whole entry an add or delete recorded, or null for an edit, which has only what changed. */
function snapshotOf(row: IncomeRow): IncomeSubject | null {
  const verb = row.action.slice(row.action.indexOf(".") + 1);
  const side = verb === "created" ? "to" : verb === "deleted" ? "from" : null;
  const { changes } = row;
  if (!side || !isRecord(changes)) return null;
  const value = (field: string) => {
    const pair = changes[field];
    return isRecord(pair) ? pair[side] : undefined;
  };
  const text = (field: string) => {
    const found = value(field);
    return typeof found === "string" ? found : null;
  };

  if (row.entity_type === "youth_income") {
    const kind = value("kind");
    const receivedOn = value("received_on");
    const amount = value("amount_cents");
    if ((kind !== "tithe" && kind !== "event") || !isDate(receivedOn) || typeof amount !== "number") return null;
    const method = value("method");
    return {
      type: "youth_income",
      entry: {
        kind,
        received_on: receivedOn,
        amount_cents: amount,
        method: isIncomeMethod(method) ? method : null,
        event_name: text("event_name"),
      },
      deleted: true,
    };
  }
  if (row.entity_type === "cafe_week") {
    const weekEnding = value("week_ending");
    const sales = value("sales_cents");
    if (!isDate(weekEnding) || typeof sales !== "number") return null;
    return { type: "cafe_week", week: { week_ending: weekEnding, sales_cents: sales, note: text("note") }, deleted: true };
  }
  return null;
}

/** The entries still there, by ID. */
export function currentIncome(
  entries: readonly (YouthIncomeEntry & { id: string })[],
  weeks: readonly (CafeWeekFields & { id: string })[],
): Map<string, IncomeSubject> {
  const subjects = new Map<string, IncomeSubject>();
  for (const { id, ...entry } of entries) subjects.set(id, { type: "youth_income", entry, deleted: false });
  for (const { id, ...week } of weeks) subjects.set(id, { type: "cafe_week", week, deleted: false });
  return subjects;
}

/**
 * What each newest-first row was about, by entry ID: the entry as it is now,
 * or for one since deleted, the newest whole copy the log holds, which is
 * the one its delete recorded.
 */
export function incomeSubjects(
  rows: readonly IncomeRow[],
  current: ReadonlyMap<string, IncomeSubject>,
): Map<string, IncomeSubject> {
  const subjects = new Map<string, IncomeSubject>();
  for (const row of rows) {
    const id = row.entity_id;
    if (!id || !isIncomeType(row.entity_type) || subjects.has(id)) continue;
    const subject = current.get(id) ?? snapshotOf(row);
    if (subject) subjects.set(id, subject);
  }
  return subjects;
}
