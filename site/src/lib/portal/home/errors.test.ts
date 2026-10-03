import { describe, expect, it } from "vitest";
import { ERROR_DAYS, errorsOverview, errorsSince, type ErrorRow } from "./errors";

const MINUTE = 60 * 1000;
// Saturday, Oct 3, 2026, 2:30 PM in Los Angeles.
const NOW = new Date("2026-10-03T21:30:00Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * MINUTE).toISOString();
}

function row(overrides: Partial<ErrorRow> = {}): ErrorRow {
  return {
    id: crypto.randomUUID(),
    source: "Save a photo",
    message: "fetch failed",
    code: null,
    env: "production",
    created_at: minutesAgo(16),
    user: null,
    ...overrides,
  };
}

describe("errorsOverview", () => {
  it("shows nothing when there were no errors", () => {
    expect(errorsOverview([], 0, NOW)).toEqual({ total: 0, groups: [], note: null });
  });

  it("names where, when, who, and the code", () => {
    const error = row({ code: "ECONNREFUSED", user: { full_name: " Sam Rivera " } });

    expect(errorsOverview([error], 1, NOW).groups).toEqual([
      {
        id: error.id,
        source: "Save a photo",
        message: "fetch failed",
        code: "ECONNREFUSED",
        staging: false,
        times: 1,
        at: error.created_at,
        when: "Today at 2:14 PM",
        who: "Sam Rivera",
      },
    ]);
  });

  it("says yesterday and earlier days in Los Angeles time", () => {
    const yesterday = row({ created_at: "2026-10-03T03:05:00Z" });
    const lastWeek = row({ source: "Email drain", created_at: "2026-09-26T18:00:00Z" });

    expect(errorsOverview([yesterday, lastWeek], 2, NOW).groups.map((group) => group.when)).toEqual([
      "Yesterday at 8:05 PM",
      "Sat, Sep 26 at 11:00 AM",
    ]);
  });

  it("tags errors from staging", () => {
    expect(errorsOverview([row({ env: "staging" })], 1, NOW).groups[0].staging).toBe(true);
  });

  it("folds repeats of the same error into one, keeping the newest", () => {
    const newest = row({ created_at: minutesAgo(1), user: { full_name: "Sam Rivera" } });
    const rows = [
      newest,
      row({ source: "Email drain" }),
      row({ created_at: minutesAgo(30) }),
      row({ created_at: minutesAgo(60) }),
    ];

    const { groups } = errorsOverview(rows, 4, NOW);

    expect(groups.map(({ source, times }) => ({ source, times }))).toEqual([
      { source: "Save a photo", times: 3 },
      { source: "Email drain", times: 1 },
    ]);
    expect(groups[0]).toMatchObject({ id: newest.id, who: "Sam Rivera", at: newest.created_at });
  });

  it("keeps the same message from staging and production apart", () => {
    expect(errorsOverview([row(), row({ env: "staging" })], 2, NOW).groups).toHaveLength(2);
  });

  it("shows the five newest kinds, and says how many there were in all", () => {
    const rows = ["A", "B", "C", "D", "E", "F"].map((source, index) => row({ source, created_at: minutesAgo(index) }));

    const overview = errorsOverview(rows, 40, NOW);

    expect(overview.groups.map((group) => group.source)).toEqual(["A", "B", "C", "D", "E"]);
    expect(overview.total).toBe(40);
    expect(overview.note).toBe("5 of 40 shown, newest first.");
  });

  it("needs no note when every error shows", () => {
    expect(errorsOverview([row(), row({ created_at: minutesAgo(40) })], 2, NOW).note).toBeNull();
  });

  it("counts what it read when the total is missing", () => {
    expect(errorsOverview([row(), row({ source: "Email drain" })], null, NOW).total).toBe(2);
  });

  it("leaves out who when nobody was signed in", () => {
    expect(errorsOverview([row({ user: { full_name: "  " } })], 1, NOW).groups[0].who).toBeNull();
  });
});

describe("errorsSince", () => {
  it("starts the list 30 days back, as long as errors are kept", () => {
    expect(ERROR_DAYS).toBe(30);
    expect(errorsSince(NOW)).toBe("2026-09-03T21:30:00.000Z");
  });
});
