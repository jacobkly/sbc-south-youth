import type { Json } from "@/lib/database.types";
import { formatDate, formatListDate, isIsoDate, type IsoDate } from "@/lib/dates";
import type { CafeWeek } from "@/lib/income/cafe";
import {
  INCOME_METHOD_LABELS,
  incomeMethodLabel,
  MIXED_LABEL,
  YOUTH_INCOME_KIND_LABELS,
  type IncomeMethod,
} from "@/lib/income/schema";
import type { YouthEntry } from "@/lib/income/stats";
import { weekLabel } from "@/lib/income/weeks";
import { formatCents } from "@/lib/money";

/** The income tables whose changes the feed shows, as the activity log names them. */
export const INCOME_ENTITY_TYPES = ["youth_income", "cafe_week"] as const;

/** One income change from the activity log. */
export type IncomeChange = {
  id: string;
  /** e.g. "youth_income.updated". */
  action: string;
  entity_type: string;
  entity_id: string | null;
  /** Each field's `from` and `to`: every field when added or deleted, and only what changed when edited. */
  changes: Json | null;
  created_at: string;
};

/** What a change was about, as it is now or, once deleted, as it was then. */
export type IncomeSubject =
  | { type: "youth_income"; entry: Omit<YouthEntry, "id">; deleted: boolean }
  | { type: "cafe_week"; week: Omit<CafeWeek, "id">; deleted: boolean };

/** An income change as an item in the feed. */
export type IncomeItem<T> = { type: "income"; key: string; created_at: string; change: T };

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

/** "created", "updated", or "deleted". */
function verbOf(action: string): string {
  return action.slice(action.indexOf(".") + 1);
}

const VERB_WORDS: Partial<Record<string, string>> = { created: "added", updated: "edited", deleted: "deleted" };

/** "Tithe added", "Event income edited", or "Cafe week deleted". */
export function incomeTitle(change: Pick<IncomeChange, "action" | "entity_type">, subject: IncomeSubject | undefined): string {
  const noun =
    change.entity_type === "cafe_week"
      ? "Cafe week"
      : subject?.type === "youth_income"
        ? subject.entry.kind === "event"
          ? "Event income"
          : "Tithe"
        : "Youth income";
  return `${noun} ${VERB_WORDS[verbOf(change.action)] ?? "changed"}`;
}

/** "$25.00 · Cash App · Oct 4", "Bake sale · $340.00 · Mixed · Oct 4", or "Sep 28 – Oct 4 · $650.00". */
export function incomeLine(subject: IncomeSubject | undefined, today: IsoDate): string {
  if (!subject) return "Since deleted";
  if (subject.type === "cafe_week") return `${weekLabel(subject.week.week_ending, today)} · ${formatCents(subject.week.sales_cents)}`;
  const { entry } = subject;
  return [
    entry.kind === "event" ? entry.event_name : null,
    formatCents(entry.amount_cents),
    incomeMethodLabel(entry.method),
    formatListDate(entry.received_on, today),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Each table's fields, in the order its form shows them, with the form's words. */
const FIELDS: Partial<Record<string, readonly (readonly [string, string])[]>> = {
  youth_income: [
    ["amount_cents", "Amount"],
    ["received_on", "Date given"],
    ["kind", "What it was"],
    ["event_name", "Event name"],
    ["method", "How it came in"],
  ],
  cafe_week: [
    ["week_ending", "Week"],
    ["sales_cents", "Sales"],
    ["note", "Note"],
  ],
};

function formatValue(field: string, value: Json | undefined, today: IsoDate): string {
  // A youth entry with no method came in more than one way.
  if (field === "method") return isIncomeMethod(value) ? INCOME_METHOD_LABELS[value] : value == null ? MIXED_LABEL : String(value);
  if (value === null || value === undefined || value === "") return "None";
  switch (field) {
    case "amount_cents":
    case "sales_cents":
      return typeof value === "number" ? formatCents(value) : String(value);
    case "received_on":
      return isDate(value) ? formatDate(value) : String(value);
    case "week_ending":
      return isDate(value) ? weekLabel(value, today) : String(value);
    case "kind":
      return value === "tithe" || value === "event" ? YOUTH_INCOME_KIND_LABELS[value] : String(value);
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

export type IncomeFieldChange = { field: string; label: string; from: string; to: string };

/** The before and after of each field an edit changed. Adds and deletes have none, since the line shows the entry. */
export function describeIncomeChanges(change: IncomeChange, today: IsoDate): IncomeFieldChange[] {
  const { changes } = change;
  if (verbOf(change.action) !== "updated" || !isRecord(changes)) return [];
  return (FIELDS[change.entity_type] ?? []).flatMap(([field, label]) => {
    const value = changes[field];
    if (!isRecord(value)) return [];
    return [{ field, label, from: formatValue(field, value.from, today), to: formatValue(field, value.to, today) }];
  });
}

/** The whole entry an add or delete recorded, or null for an edit, which has only what changed. */
function snapshotOf(change: IncomeChange): IncomeSubject | null {
  const verb = verbOf(change.action);
  const side = verb === "created" ? "to" : verb === "deleted" ? "from" : null;
  const { changes } = change;
  if (!side || !isRecord(changes)) return null;
  const value = (field: string) => {
    const pair = changes[field];
    return isRecord(pair) ? pair[side] : undefined;
  };
  const text = (field: string) => {
    const found = value(field);
    return typeof found === "string" ? found : null;
  };

  if (change.entity_type === "youth_income") {
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
  if (change.entity_type === "cafe_week") {
    const weekEnding = value("week_ending");
    const sales = value("sales_cents");
    if (!isDate(weekEnding) || typeof sales !== "number") return null;
    return { type: "cafe_week", week: { week_ending: weekEnding, sales_cents: sales, note: text("note") }, deleted: true };
  }
  return null;
}

/** The entries still there, by id. */
export function currentSubjects(
  entries: readonly YouthEntry[],
  weeks: readonly CafeWeek[],
): Map<string, IncomeSubject> {
  const subjects = new Map<string, IncomeSubject>();
  for (const { id, ...entry } of entries) subjects.set(id, { type: "youth_income", entry, deleted: false });
  for (const { id, ...week } of weeks) subjects.set(id, { type: "cafe_week", week, deleted: false });
  return subjects;
}

/**
 * What each newest-first change was about, by entry id: the entry as it is
 * now, or for one since deleted, the newest whole copy the log holds, which
 * is the one its delete recorded.
 */
export function incomeSubjects(
  changes: readonly IncomeChange[],
  current: ReadonlyMap<string, IncomeSubject>,
): Map<string, IncomeSubject> {
  const subjects = new Map<string, IncomeSubject>();
  for (const change of changes) {
    const id = change.entity_id;
    if (!id || subjects.has(id)) continue;
    const subject = current.get(id) ?? snapshotOf(change);
    if (subject) subjects.set(id, subject);
  }
  return subjects;
}

type Stamped = { id: string; created_at: string };

/** Whether `a` comes first newest first, breaking ties by the higher id like the queries do. */
function isNewer(a: Stamped, b: Stamped): boolean {
  const diff = Date.parse(a.created_at) - Date.parse(b.created_at);
  return diff === 0 ? a.id > b.id : diff > 0;
}

/** The `count` newest of two newest-first lists, kept apart, and whether there were more. */
export function takeNewest<A extends Stamped, B extends Stamped>(
  a: readonly A[],
  b: readonly B[],
  count: number,
): { a: A[]; b: B[]; more: boolean } {
  const keptA: A[] = [];
  const keptB: B[] = [];
  let i = 0;
  let j = 0;
  while (keptA.length + keptB.length < count && (i < a.length || j < b.length)) {
    if (j >= b.length || (i < a.length && isNewer(a[i], b[j]))) keptA.push(a[i++]);
    else keptB.push(b[j++]);
  }
  return { a: keptA, b: keptB, more: a.length + b.length > count };
}

/** Newest-first request items with newest-first income changes, as one newest-first feed. */
export function mergeIncome<R extends { created_at: string }, T extends IncomeChange>(
  items: readonly R[],
  changes: readonly T[],
): (R | IncomeItem<T>)[] {
  const merged: (R | IncomeItem<T>)[] = [];
  const asItem = (change: T): IncomeItem<T> => ({ type: "income", key: change.id, created_at: change.created_at, change });
  let next = 0;
  for (const item of items) {
    while (next < changes.length && Date.parse(changes[next].created_at) > Date.parse(item.created_at)) {
      merged.push(asItem(changes[next++]));
    }
    merged.push(item);
  }
  for (const change of changes.slice(next)) merged.push(asItem(change));
  return merged;
}
