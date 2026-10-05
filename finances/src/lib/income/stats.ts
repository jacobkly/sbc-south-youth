import { periodContaining, type MonthPeriod } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";
import { INCOME_METHODS, type IncomeMethod } from "./schema";

export type YouthEntry = Pick<
  Tables<"youth_income">,
  "id" | "kind" | "received_on" | "amount_cents" | "method" | "event_name"
>;

/**
 * Tithes for a period. With no names, these are per tithe, not per person:
 * the app can't say how many people gave.
 */
export type TitheStats = {
  count: number;
  total: number;
  /** In whole cents. Null with no tithes. */
  average: number | null;
  /** The middle tithe, or the two middle ones averaged. Null with no tithes. */
  median: number | null;
  byMethod: { method: IncomeMethod; count: number; total: number }[];
};

const sum = (entries: readonly YouthEntry[]) => entries.reduce((total, entry) => total + entry.amount_cents, 0);

/** Stats for the tithes among some entries. Events stay out, so one bake sale doesn't skew the average. */
export function titheStats(entries: readonly YouthEntry[]): TitheStats {
  const tithes = entries.filter((entry) => entry.kind === "tithe");
  const total = sum(tithes);
  const amounts = tithes.map((entry) => entry.amount_cents).sort((a, b) => a - b);
  const middle = Math.floor(amounts.length / 2);

  return {
    count: tithes.length,
    total,
    average: tithes.length ? Math.round(total / tithes.length) : null,
    median: !amounts.length
      ? null
      : amounts.length % 2
        ? amounts[middle]
        : Math.round((amounts[middle - 1] + amounts[middle]) / 2),
    byMethod: INCOME_METHODS.map((method) => {
      const matching = tithes.filter((entry) => entry.method === method);
      return { method, count: matching.length, total: sum(matching) };
    }),
  };
}

export type YouthSummary = {
  /** Tithes and events together: everything youth took in. */
  total: number;
  tithes: TitheStats;
  events: { count: number; total: number };
};

export function youthSummary(entries: readonly YouthEntry[]): YouthSummary {
  const events = entries.filter((entry) => entry.kind === "event");
  return {
    total: sum(entries),
    tithes: titheStats(entries),
    events: { count: events.length, total: sum(events) },
  };
}

export type MonthGroup = { period: MonthPeriod; total: number; entries: YouthEntry[] };

/** Entries by the month they came in. Expects them newest first, and keeps that order. */
export function groupByMonth<T extends YouthEntry>(entries: readonly T[]): (MonthGroup & { entries: T[] })[] {
  const groups: (MonthGroup & { entries: T[] })[] = [];
  let month = "";
  for (const entry of entries) {
    let group = groups.at(-1);
    if (!group || entry.received_on.slice(0, 7) !== month) {
      month = entry.received_on.slice(0, 7);
      group = { period: periodContaining("month", entry.received_on) as MonthPeriod, total: 0, entries: [] };
      groups.push(group);
    }
    group.total += entry.amount_cents;
    group.entries.push(entry);
  }
  return groups;
}
