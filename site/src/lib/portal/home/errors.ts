import { formatDayLabel, formatTime, laDateOf, todayInLA } from "@/lib/dates";

/**
 * The errors section on an owner's Home, from the owners' error log. The
 * same error often happens several times in a row, so repeats fold into
 * one line with a count, and Home shows the five newest kinds.
 */

/** How long the log keeps errors, so how far back Home looks. */
export const ERROR_DAYS = 30;
export const SHOWN_ERRORS = 5;
/** How many of the newest rows Home reads to fold repeats. */
export const READ_ERRORS = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A row as Home reads it, with the name of whoever hit it. */
export type ErrorRow = {
  id: string;
  source: string;
  message: string;
  code: string | null;
  env: string;
  created_at: string;
  user: { full_name: string } | null;
};

export type ErrorGroup = {
  /** The newest row's ID. */
  id: string;
  source: string;
  message: string;
  code: string | null;
  staging: boolean;
  /** How many times it happened among the rows read. */
  times: number;
  at: string;
  /** "Today at 2:14 PM", in LA. */
  when: string;
  who: string | null;
};

export type ErrorsOverview = { total: number; groups: ErrorGroup[]; note: string | null };

/** The oldest time Home lists, as long ago as the log keeps errors. */
export function errorsSince(now: Date = new Date()): string {
  return new Date(now.getTime() - ERROR_DAYS * DAY_MS).toISOString();
}

/**
 * The newest kinds of error from `rows`, newest first, with `total` from
 * the last 30 days. Repeats count toward the newest of their kind.
 */
export function errorsOverview(rows: ErrorRow[], total: number | null, now: Date = new Date()): ErrorsOverview {
  const today = todayInLA(now);
  const byKind = new Map<string, ErrorGroup>();
  const newestFirst = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  for (const row of newestFirst) {
    const kind = JSON.stringify([row.env, row.source, row.message]);
    const seen = byKind.get(kind);
    if (seen) {
      seen.times += 1;
      continue;
    }
    byKind.set(kind, {
      id: row.id,
      source: row.source,
      message: row.message,
      code: row.code,
      staging: row.env === "staging",
      times: 1,
      at: row.created_at,
      when: `${formatDayLabel(laDateOf(row.created_at), today)} at ${formatTime(row.created_at)}`,
      who: row.user?.full_name.trim() || null,
    });
  }

  const groups = [...byKind.values()].slice(0, SHOWN_ERRORS);
  const shown = groups.reduce((sum, group) => sum + group.times, 0);
  const all = Math.max(total ?? rows.length, rows.length);
  return { total: all, groups, note: all > shown ? `${shown} of ${all} shown, newest first.` : null };
}
