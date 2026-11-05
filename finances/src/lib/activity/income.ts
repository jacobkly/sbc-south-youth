import type { Json } from "@/lib/database.types";
import { formatDate, formatListDate, isIsoDate, periodContaining, periodLabel, type IsoDate } from "@/lib/dates";
import {
  CAFE_PAYBACK_KIND_LABELS,
  moneyFromSquare,
  NO_LINES,
  type CafeLines,
  type CafePayback,
  type CafePaybackKind,
  type CafeWeek,
} from "@/lib/income/cafe";
import {
  INCOME_METHOD_LABELS,
  incomeMethodLabel,
  MIXED_LABEL,
  YOUTH_INCOME_KIND_LABELS,
  type IncomeMethod,
} from "@/lib/income/schema";
import type { YouthEntry } from "@/lib/income/stats";
import { weekLabel, weekStartOf } from "@/lib/income/weeks";
import { formatCents } from "@/lib/money";
import { rangeLabel } from "@/lib/reports/comparison";

/** The income tables whose changes the feed shows, as the activity log names them. */
export const INCOME_ENTITY_TYPES = ["youth_income", "cafe_week", "cafe_payback"] as const;

/** One income change from the activity log. */
export type IncomeChange = {
  id: string;
  actor_id?: string | null;
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
  | { type: "cafe_week"; week: Omit<CafeWeek, "id">; deleted: boolean }
  | { type: "cafe_payback"; payback: Omit<CafePayback, "id">; deleted: boolean };

/** An income change as an item in the feed. */
export type IncomeItem<T> = { type: "income"; key: string; created_at: string; change: T };

/** Weeks added at one instant by one person, which only an import does at this many. */
const CAFE_IMPORT_WEEKS = 3;

/** A cafe import as one item in the feed. Each week it added keeps its own row in the log. */
export type CafeImportItem<T> = { type: "cafe_import"; key: string; created_at: string; changes: T[] };

type JsonRecord = { [key: string]: Json | undefined };

function isRecord(value: Json | null | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIncomeMethod(value: Json | undefined): value is IncomeMethod {
  return typeof value === "string" && Object.hasOwn(INCOME_METHOD_LABELS, value);
}

function isPaybackKind(value: Json | undefined): value is CafePaybackKind {
  return typeof value === "string" && Object.hasOwn(CAFE_PAYBACK_KIND_LABELS, value);
}

function isDate(value: Json | undefined): value is IsoDate {
  return typeof value === "string" && isIsoDate(value);
}

/** "Q3 2026" for the quarter starting on a date. */
function quarterLabel(start: IsoDate): string {
  return periodLabel(periodContaining("quarter", start));
}

/** "created", "updated", "deleted", or "imported". */
function verbOf(action: string): string {
  return action.slice(action.indexOf(".") + 1);
}

const VERB_WORDS: Partial<Record<string, string>> = { created: "added", updated: "edited", deleted: "deleted" };

/** What a tithe import recorded: one entry for every tithe it added. */
export type TitheImport = { count: number; totalCents: number; method: IncomeMethod; firstOn: IsoDate; lastOn: IsoDate };

/** What a tithe import recorded, or null for any other change. */
export function titheImportOf(change: Pick<IncomeChange, "action" | "changes">): TitheImport | null {
  const { changes } = change;
  if (verbOf(change.action) !== "imported" || !isRecord(changes)) return null;
  const { count, total_cents: totalCents, method, first_on: firstOn, last_on: lastOn } = changes;
  if (typeof count !== "number" || typeof totalCents !== "number") return null;
  if (!isIncomeMethod(method) || !isDate(firstOn) || !isDate(lastOn)) return null;
  return { count, totalCents, method, firstOn, lastOn };
}

/** "$1,234.00 · Cash App · Jan 4 – Feb 1, 2026" */
export function titheImportLine(imported: TitheImport): string {
  return [
    formatCents(imported.totalCents),
    INCOME_METHOD_LABELS[imported.method],
    rangeLabel({ start: imported.firstOn, end: imported.lastOn }),
  ].join(" · ");
}

/** "Tithe added", "Event income edited", "Cafe week deleted", "Church payback added", or "Imported 48 tithes". */
export function incomeTitle(
  change: Pick<IncomeChange, "action" | "entity_type" | "changes">,
  subject: IncomeSubject | undefined,
): string {
  if (verbOf(change.action) === "imported") {
    const imported = titheImportOf(change);
    if (!imported) return "Tithes imported";
    return `Imported ${imported.count.toLocaleString("en-US")} ${imported.count === 1 ? "tithe" : "tithes"}`;
  }
  const noun =
    change.entity_type === "cafe_week"
      ? "Cafe week"
      : change.entity_type === "cafe_payback"
        ? "Church payback"
        : subject?.type === "youth_income"
        ? subject.entry.kind === "event"
          ? "Event income"
          : "Tithe"
        : "Youth income";
  return `${noun} ${VERB_WORDS[verbOf(change.action)] ?? "changed"}`;
}

/**
 * "$25.00 · Cash App · Oct 4", "Bake sale · $340.00 · Mixed · Oct 4",
 * "Sep 28 – Oct 4 · $650.00" with the money from Square, or
 * "Q3 2026 discounts · $120.00 · Oct 2" (or gift cards).
 */
export function incomeLine(subject: IncomeSubject | undefined, today: IsoDate): string {
  if (!subject) return "Since deleted";
  if (subject.type === "cafe_week") {
    return `${weekLabel(subject.week.week_ending, today)} · ${formatCents(moneyFromSquare(subject.week))}`;
  }
  if (subject.type === "cafe_payback") {
    const { payback } = subject;
    return [
      `${quarterLabel(payback.quarter_start)} ${CAFE_PAYBACK_KIND_LABELS[payback.kind].toLowerCase()}`,
      formatCents(payback.amount_cents),
      formatListDate(payback.received_on, today),
    ].join(" · ");
  }
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
    ["sales_cents", "Gross sales"],
    ["discounts_cents", "Discounts & comps"],
    ["tips_cents", "Tips"],
    ["fees_cents", "Fees"],
    ["returns_cents", "Returns"],
    ["gift_card_sales_cents", "Gift card sales"],
    ["gift_card_redeemed_cents", "Gift card redeemed"],
    ["taxes_cents", "Taxes"],
    ["source", "Entered"],
    ["note", "Note"],
  ],
  cafe_payback: [
    ["kind", "For"],
    ["quarter_start", "Quarter"],
    ["received_on", "Date received"],
    ["amount_cents", "Amount"],
    ["note", "Note"],
  ],
};

/** A cafe week's Square lines, as the log names them. */
const CAFE_LINE_FIELDS = Object.keys(NO_LINES) as (keyof CafeLines)[];

const SOURCE_LABELS: Partial<Record<string, string>> = { manual: "By hand", square: "From Square" };

function formatValue(field: string, value: Json | undefined, today: IsoDate): string {
  // A youth entry with no method came in more than one way.
  if (field === "method") return isIncomeMethod(value) ? INCOME_METHOD_LABELS[value] : value == null ? MIXED_LABEL : String(value);
  if (value === null || value === undefined || value === "") return "None";
  if (field.endsWith("_cents")) return typeof value === "number" ? formatCents(value) : String(value);
  switch (field) {
    case "received_on":
      return isDate(value) ? formatDate(value) : String(value);
    case "week_ending":
      return isDate(value) ? weekLabel(value, today) : String(value);
    case "quarter_start":
      return isDate(value) ? quarterLabel(value) : String(value);
    case "source":
      return (typeof value === "string" && SOURCE_LABELS[value]) || String(value);
    case "kind":
      // A youth entry's kind, or what a church payback was for.
      return value === "tithe" || value === "event"
        ? YOUTH_INCOME_KIND_LABELS[value]
        : isPaybackKind(value)
          ? CAFE_PAYBACK_KIND_LABELS[value]
          : String(value);
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
    if (!isDate(weekEnding) || typeof value("sales_cents") !== "number") return null;
    // Weeks logged before Square's lines were kept have only their gross.
    const lines = { ...NO_LINES };
    for (const field of CAFE_LINE_FIELDS) {
      const cents = value(field);
      if (typeof cents === "number") lines[field] = cents;
    }
    return {
      type: "cafe_week",
      week: { week_ending: weekEnding, ...lines, source: text("source") ?? "manual", note: text("note") },
      deleted: true,
    };
  }
  if (change.entity_type === "cafe_payback") {
    const kind = value("kind");
    const quarterStart = value("quarter_start");
    const receivedOn = value("received_on");
    const amount = value("amount_cents");
    if (!isPaybackKind(kind) || !isDate(quarterStart) || !isDate(receivedOn) || typeof amount !== "number") return null;
    return {
      type: "cafe_payback",
      payback: { kind, quarter_start: quarterStart, received_on: receivedOn, amount_cents: amount, note: text("note") },
      deleted: true,
    };
  }
  return null;
}

/** The entries still there, by id. */
export function currentSubjects(
  entries: readonly YouthEntry[],
  weeks: readonly CafeWeek[],
  paybacks: readonly CafePayback[],
): Map<string, IncomeSubject> {
  const subjects = new Map<string, IncomeSubject>();
  for (const { id, ...entry } of entries) subjects.set(id, { type: "youth_income", entry, deleted: false });
  for (const { id, ...week } of weeks) subjects.set(id, { type: "cafe_week", week, deleted: false });
  for (const { id, ...payback } of paybacks) subjects.set(id, { type: "cafe_payback", payback, deleted: false });
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

/** "Imported 312 cafe weeks" */
export function cafeImportTitle(changes: readonly IncomeChange[]): string {
  return `Imported ${changes.length.toLocaleString("en-US")} cafe weeks`;
}

/** "$12,345.67 · Oct 12, 2020 – Nov 1, 2026": the money from Square, as the import recorded it. */
export function cafeImportLine(changes: readonly IncomeChange[]): string {
  const weeks = changes.flatMap((change) => {
    const subject = snapshotOf(change);
    return subject?.type === "cafe_week" ? [subject.week] : [];
  });
  const endings = weeks.map((week) => week.week_ending).sort();
  const [first, last] = [endings[0], endings.at(-1)];
  if (!first || !last) return "From Square";
  const money = weeks.reduce((total, week) => total + moneyFromSquare(week), 0);
  return `${formatCents(money)} · ${rangeLabel({ start: weekStartOf(first), end: last })}`;
}

/** Income changes as feed items, with the weeks an import added folded into one. */
function incomeItems<T extends IncomeChange>(changes: readonly T[]): (IncomeItem<T> | CafeImportItem<T>)[] {
  const isWeekAdded = (change: T) => change.action === "cafe_week.created";
  const instantOf = (change: T) => `${change.actor_id}|${change.created_at}`;
  const weeksAt = new Map<string, T[]>();
  for (const change of changes) {
    if (!isWeekAdded(change)) continue;
    const weeks = weeksAt.get(instantOf(change));
    if (weeks) weeks.push(change);
    else weeksAt.set(instantOf(change), [change]);
  }

  return changes.flatMap((change): (IncomeItem<T> | CafeImportItem<T>)[] => {
    const weeks = isWeekAdded(change) ? weeksAt.get(instantOf(change)) : undefined;
    if (!weeks || weeks.length < CAFE_IMPORT_WEEKS) {
      return [{ type: "income", key: change.id, created_at: change.created_at, change }];
    }
    return weeks[0] === change ? [{ type: "cafe_import", key: change.id, created_at: change.created_at, changes: weeks }] : [];
  });
}

/** Newest-first request items with newest-first income changes, as one newest-first feed. */
export function mergeIncome<R extends { created_at: string }, T extends IncomeChange>(
  items: readonly R[],
  changes: readonly T[],
): (R | IncomeItem<T> | CafeImportItem<T>)[] {
  const income = incomeItems(changes);
  const merged: (R | IncomeItem<T> | CafeImportItem<T>)[] = [];
  let next = 0;
  for (const item of items) {
    while (next < income.length && Date.parse(income[next].created_at) > Date.parse(item.created_at)) {
      merged.push(income[next++]);
    }
    merged.push(item);
  }
  merged.push(...income.slice(next));
  return merged;
}
