import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  containsPattern,
  DEFAULT_QUEUE_FILTERS,
  defaultTab,
  isFiltered,
  MAX_QUEUE_PAGES,
  ownDraftsFilter,
  parseQueueFilters,
  queueHref,
  requestNumberIn,
  searchFilter,
  sortsByPurchaseDate,
} from "./queue";

const PAYEE = "0b7c6a8e-4f1d-4c2a-9e3b-5d6f7a8b9c0d";

describe("parseQueueFilters", () => {
  it("leaves the tab to be picked, with nothing filtered", () => {
    expect(parseQueueFilters({})).toEqual(DEFAULT_QUEUE_FILTERS);
    expect(DEFAULT_QUEUE_FILTERS.tab).toBeNull();
  });

  it("reads every filter", () => {
    expect(
      parseQueueFilters({
        tab: "paid",
        q: "  pizza  ",
        from: "2026-01-01",
        to: "2026-03-31",
        type: "cafe",
        payee: PAYEE.toUpperCase(),
        missing: "1",
        pages: "3",
      }),
    ).toEqual({
      tab: "paid",
      q: "pizza",
      from: "2026-01-01",
      to: "2026-03-31",
      type: "cafe",
      payee: PAYEE,
      missingReceipt: true,
      pages: 3,
    });
  });

  it("ignores values it doesn't recognize", () => {
    expect(
      parseQueueFilters({
        tab: "archive",
        from: "2026-02-30",
        to: "yesterday",
        type: "travel",
        payee: "not-a-uuid",
        missing: "yes",
        pages: "2.5",
      }),
    ).toEqual(DEFAULT_QUEUE_FILTERS);
  });

  it("takes the first of repeated params", () => {
    expect(parseQueueFilters({ tab: ["paid", "pay"] }).tab).toBe("paid");
  });

  it("keeps pages within range", () => {
    expect(parseQueueFilters({ pages: "0" }).pages).toBe(1);
    expect(parseQueueFilters({ pages: "-4" }).pages).toBe(1);
    expect(parseQueueFilters({ pages: "9999" }).pages).toBe(MAX_QUEUE_PAGES);
  });

  it("caps the search length", () => {
    expect(parseQueueFilters({ q: "a".repeat(300) }).q).toHaveLength(100);
  });
});

describe("defaultTab", () => {
  const none = { all: 0, pay: 0, review: 0, info: 0, paid: 0, closed: 0 };

  it("opens To pay first when anything is waiting to be paid", () => {
    expect(defaultTab({ ...none, all: 5, pay: 1, review: 2, info: 1 })).toBe("pay");
  });

  it("then Awaiting review, then Needs info", () => {
    expect(defaultTab({ ...none, all: 3, review: 2, info: 1 })).toBe("review");
    expect(defaultTab({ ...none, all: 1, info: 1 })).toBe("info");
  });

  it("opens All when nothing is waiting", () => {
    expect(defaultTab({ ...none, all: 4, paid: 3, closed: 1 })).toBe("all");
    expect(defaultTab(none)).toBe("all");
  });
});

describe("queueHref", () => {
  it("leaves out the defaults", () => {
    expect(queueHref(DEFAULT_QUEUE_FILTERS)).toBe("/admin/requests");
  });

  it("keeps a chosen tab, so it isn't picked again", () => {
    expect(queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "all" })).toBe("/admin/requests?tab=all");
  });

  it("round-trips through parseQueueFilters", () => {
    const filters = {
      tab: "closed",
      q: "R-0012 & co",
      from: "2026-01-01",
      to: "2026-01-31",
      type: "youth",
      payee: PAYEE,
      missingReceipt: true,
      pages: 2,
    } as const;
    const href = queueHref(filters);
    const params = Object.fromEntries(new URL(href, "http://localhost").searchParams);
    expect(parseQueueFilters(params)).toEqual(filters);
  });

  it("drops a blank search", () => {
    expect(queueHref({ ...DEFAULT_QUEUE_FILTERS, q: "   " })).toBe("/admin/requests");
  });
});

describe("activeFilterCount and isFiltered", () => {
  it("counts a date range once", () => {
    expect(activeFilterCount({ ...DEFAULT_QUEUE_FILTERS, from: "2026-01-01", to: "2026-02-01" })).toBe(1);
  });

  it("counts each filter but not the tab or search", () => {
    expect(
      activeFilterCount({ ...DEFAULT_QUEUE_FILTERS, tab: "all", q: "x", type: "cafe", payee: PAYEE, missingReceipt: true }),
    ).toBe(3);
  });

  it("treats a search as filtering", () => {
    expect(isFiltered(DEFAULT_QUEUE_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_QUEUE_FILTERS, tab: "all" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_QUEUE_FILTERS, q: "x" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_QUEUE_FILTERS, missingReceipt: true })).toBe(true);
  });
});

describe("sortsByPurchaseDate", () => {
  it("goes by paid or created date until a purchase date range is set", () => {
    expect(sortsByPurchaseDate(DEFAULT_QUEUE_FILTERS)).toBe(false);
    expect(sortsByPurchaseDate({ ...DEFAULT_QUEUE_FILTERS, from: "2026-09-01" })).toBe(true);
    expect(sortsByPurchaseDate({ ...DEFAULT_QUEUE_FILTERS, to: "2026-09-30" })).toBe(true);
  });
});

describe("requestNumberIn", () => {
  it("reads R-numbers however they're typed", () => {
    expect(requestNumberIn("R-0012")).toBe(12);
    expect(requestNumberIn("r12")).toBe(12);
    expect(requestNumberIn("r- 12")).toBe(12);
    expect(requestNumberIn("0012")).toBe(12);
    expect(requestNumberIn(" 7 ")).toBe(7);
  });

  it("ignores anything else", () => {
    expect(requestNumberIn("Costco")).toBeNull();
    expect(requestNumberIn("R-")).toBeNull();
    expect(requestNumberIn("12.50")).toBeNull();
    expect(requestNumberIn("1234567890")).toBeNull();
  });
});

describe("containsPattern", () => {
  it("wraps the term in wildcards", () => {
    expect(containsPattern("pizza")).toBe("%pizza%");
  });

  it("takes the term's own wildcards literally", () => {
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("searchFilter", () => {
  it("searches the text columns", () => {
    expect(searchFilter("pizza", [])).toBe(
      'vendor.ilike."%pizza%",description.ilike."%pizza%",event_name.ilike."%pizza%"',
    );
  });

  it("adds matching payees and the request number", () => {
    expect(searchFilter("12", [PAYEE])).toBe(
      'vendor.ilike."%12%",description.ilike."%12%",event_name.ilike."%12%",' +
        `payee_id.in.(${PAYEE}),request_number.eq.12`,
    );
  });

  it("keeps punctuation inside the quotes", () => {
    expect(searchFilter('Joe\'s, "Inc." (east)', [])).toBe(
      [
        'vendor.ilike."%Joe\'s, \\"Inc.\\" (east)%"',
        'description.ilike."%Joe\'s, \\"Inc.\\" (east)%"',
        'event_name.ilike."%Joe\'s, \\"Inc.\\" (east)%"',
      ].join(","),
    );
  });

  it("escapes backslashes after the wildcard escape", () => {
    expect(searchFilter("a_b", [])).toContain('vendor.ilike."%a\\\\_b%"');
  });
});

describe("ownDraftsFilter", () => {
  it("keeps every sent request and only the drafts the person started", () => {
    const userId = "5c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
    expect(ownDraftsFilter(userId)).toBe(`status.neq.draft,created_by.eq.${userId}`);
  });
});
