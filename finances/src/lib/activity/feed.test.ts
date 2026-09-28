import { describe, expect, it } from "vitest";
import { EVENT_ACTION_LABELS, type EventAction } from "@/lib/requests/status";
import {
  ACTIVITY_KIND_ACTIONS,
  activityHref,
  dayLabel,
  DEFAULT_ACTIVITY_FILTERS,
  groupBursts,
  groupByDay,
  itemTitle,
  kindOf,
  leadEvent,
  MAX_ACTIVITY_PAGES,
  parseActivityFilters,
} from "./feed";

describe("kindOf", () => {
  it("puts every action in exactly one kind", () => {
    const actions = Object.keys(EVENT_ACTION_LABELS) as EventAction[];
    for (const action of actions) {
      const kinds = Object.entries(ACTIVITY_KIND_ACTIONS).filter(([, list]) => list.includes(action));
      expect(kinds, action).toHaveLength(1);
      expect(kindOf(action)).toBe(kinds[0][0]);
    }
  });

  it("files receipt changes under receipts and payments under payments", () => {
    expect(kindOf("receipt_added")).toBe("receipts");
    expect(kindOf("receipt_removed")).toBe("receipts");
    expect(kindOf("recorded_paid")).toBe("payments");
    expect(kindOf("unpaid")).toBe("payments");
    expect(kindOf("rejected")).toBe("status");
    expect(kindOf("updated")).toBe("edits");
  });
});

describe("parseActivityFilters", () => {
  it("reads the kind and pages", () => {
    expect(parseActivityFilters({ kind: "receipts", pages: "3" })).toEqual({ kind: "receipts", pages: 3 });
  });

  it("falls back to the defaults for anything it doesn't recognize", () => {
    expect(parseActivityFilters({})).toEqual(DEFAULT_ACTIVITY_FILTERS);
    expect(parseActivityFilters({ kind: "photos", pages: "0" })).toEqual(DEFAULT_ACTIVITY_FILTERS);
    expect(parseActivityFilters({ kind: ["edits", "status"], pages: "1.5" })).toEqual({ kind: "edits", pages: 1 });
  });

  it("caps the pages", () => {
    expect(parseActivityFilters({ pages: "9999" }).pages).toBe(MAX_ACTIVITY_PAGES);
  });
});

describe("activityHref", () => {
  it("leaves out the defaults", () => {
    expect(activityHref(DEFAULT_ACTIVITY_FILTERS)).toBe("/admin/activity");
  });

  it("keeps the kind and pages", () => {
    expect(activityHref({ kind: "payments", pages: 2 })).toBe("/admin/activity?kind=payments&pages=2");
  });
});

describe("dayLabel", () => {
  it("names today and yesterday", () => {
    expect(dayLabel("2026-09-28", "2026-09-28")).toBe("Today");
    expect(dayLabel("2026-09-27", "2026-09-28")).toBe("Yesterday");
    expect(dayLabel("2025-12-31", "2026-01-01")).toBe("Yesterday");
  });

  it("gives older days their weekday, and the year when it isn't this one", () => {
    expect(dayLabel("2026-09-25", "2026-09-28")).toBe("Fri, Sep 25");
    expect(dayLabel("2025-12-30", "2026-01-01")).toBe("Tue, Dec 30, 2025");
  });
});

describe("groupByDay", () => {
  it("groups newest-first items under their LA day, keeping their order", () => {
    const items = [
      { id: "a", created_at: "2026-09-28T18:00:00Z" },
      { id: "b", created_at: "2026-09-28T07:30:00Z" }, // 12:30 AM on the 28th in LA
      { id: "c", created_at: "2026-09-28T06:30:00Z" }, // 11:30 PM on the 27th in LA
      { id: "d", created_at: "2026-09-25T20:00:00Z" },
    ];
    expect(groupByDay(items, "2026-09-28")).toEqual([
      { date: "2026-09-28", label: "Today", items: [items[0], items[1]] },
      { date: "2026-09-27", label: "Yesterday", items: [items[2]] },
      { date: "2026-09-25", label: "Fri, Sep 25", items: [items[3]] },
    ]);
  });

  it("returns nothing for no items", () => {
    expect(groupByDay([], "2026-09-28")).toEqual([]);
  });
});

type TestEvent = {
  id: string;
  action: string;
  from_status: null;
  request_id: string;
  actor_id: string | null;
  created_at: string;
};

let nextId = 0;
function event(request_id: string, created_at: string, action = "updated", actor_id: string | null = "admin"): TestEvent {
  nextId += 1;
  return { id: `e${nextId}`, action, from_status: null, request_id, actor_id, created_at };
}

const ids = (items: { events: TestEvent[] }[]) => items.map((item) => item.events.map((each) => each.id));

describe("groupBursts", () => {
  it("puts one person's events on a request within 5 minutes into one item, oldest first", () => {
    const created = event("r1", "2026-09-28T18:00:00Z", "created");
    const file = event("r1", "2026-09-28T18:01:30Z", "receipt_added");
    const paid = event("r1", "2026-09-28T18:03:00Z", "recorded_paid");
    const items = groupBursts([paid, file, created]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "request", key: paid.id, created_at: paid.created_at });
    expect(ids(items)).toEqual([[created.id, file.id, paid.id]]);
  });

  it("keeps a burst going while each event is within 5 minutes of the last", () => {
    const events = [
      event("r1", "2026-09-28T18:08:00Z"),
      event("r1", "2026-09-28T18:04:00Z"),
      event("r1", "2026-09-28T18:00:00Z"),
    ];
    expect(groupBursts(events)).toHaveLength(1);
  });

  it("starts a new item after a 6 minute gap", () => {
    const later = event("r1", "2026-09-28T18:06:00Z");
    const earlier = event("r1", "2026-09-28T18:00:00Z");
    expect(ids(groupBursts([later, earlier]))).toEqual([[later.id], [earlier.id]]);
  });

  it("keeps two people's events on one request apart", () => {
    const theirs = event("r1", "2026-09-28T18:01:00Z", "approved", "other");
    const mine = event("r1", "2026-09-28T18:00:00Z", "submitted", "admin");
    expect(ids(groupBursts([theirs, mine]))).toEqual([[theirs.id], [mine.id]]);
  });

  it("gathers a request's events around another request's, at its newest place", () => {
    const r1Late = event("r1", "2026-09-28T18:02:00Z", "receipt_added");
    const r2 = event("r2", "2026-09-28T18:01:00Z", "created");
    const r1Early = event("r1", "2026-09-28T18:00:00Z", "created");
    expect(ids(groupBursts([r1Late, r2, r1Early]))).toEqual([[r1Early.id, r1Late.id], [r2.id]]);
  });

  it("never runs a burst across LA midnight", () => {
    const after = event("r1", "2026-09-28T07:01:00Z"); // 12:01 AM on the 28th in LA
    const before = event("r1", "2026-09-28T06:59:00Z"); // 11:59 PM on the 27th
    expect(ids(groupBursts([after, before]))).toEqual([[after.id], [before.id]]);
  });

  it("makes one bulk item of 3 or more requests changed at the same instant by one person", () => {
    const at = "2026-09-28T18:00:00.123456+00:00";
    const events = ["r1", "r2", "r3"].flatMap((request) => [event(request, at, "recorded_paid"), event(request, at, "created")]);
    const before = event("r9", "2026-09-28T17:00:00Z");
    const items = groupBursts([...events, before]);
    expect(items.map((item) => item.type)).toEqual(["bulk", "request"]);
    expect(items[0].events).toHaveLength(6);
  });

  it("doesn't make a bulk item of only 2 requests", () => {
    const at = "2026-09-28T18:00:00Z";
    const items = groupBursts([event("r1", at, "recorded_paid"), event("r2", at, "recorded_paid")]);
    expect(items.map((item) => item.type)).toEqual(["request", "request"]);
  });

  it("lists events at the same instant in the order they happen", () => {
    const at = "2026-09-28T18:00:00Z";
    const paid = event("r1", at, "recorded_paid");
    const created = event("r1", at, "created");
    expect(ids(groupBursts([paid, created]))).toEqual([[created.id, paid.id]]);
  });
});

describe("itemTitle", () => {
  const at = "2026-09-28T18:00:00Z";

  it("is the event's own title for one event", () => {
    expect(itemTitle({ type: "request", events: [event("r1", at, "receipt_added")] })).toBe("File added");
  });

  it("lists a burst's actions once each, counting files", () => {
    const events = [
      event("r1", at, "created"),
      event("r1", at, "receipt_added"),
      event("r1", at, "receipt_added"),
      event("r1", at, "updated"),
      event("r1", at, "updated"),
      event("r1", at, "recorded_paid"),
    ];
    expect(itemTitle({ type: "request", events })).toBe("Created, 2 files added, edited, recorded as paid");
  });

  it("names an import by how many requests it paid", () => {
    const events = ["r1", "r2", "r3"].flatMap((request) => [event(request, at, "created"), event(request, at, "recorded_paid")]);
    expect(itemTitle({ type: "bulk", events })).toBe("Imported 3 paid requests");
  });

  it("names a bulk of new requests by how many it created", () => {
    const events = ["r1", "r2", "r3"].map((request) => event(request, at, "created"));
    expect(itemTitle({ type: "bulk", events })).toBe("Created 3 requests at once");
  });

  it("names any other bulk change by how many requests it touched", () => {
    const events = ["r1", "r2", "r3"].map((request) => event(request, at, "updated"));
    expect(itemTitle({ type: "bulk", events })).toBe("Changed 3 requests at once");
  });
});

describe("leadEvent", () => {
  const at = "2026-09-28T18:00:00Z";

  it("picks the latest payment, then status change, then file, then edit", () => {
    const created = event("r1", at, "created");
    const file = event("r1", at, "receipt_added");
    const paid = event("r1", at, "recorded_paid");
    expect(leadEvent([created, file, paid, event("r1", at, "updated")])).toBe(paid);
    expect(leadEvent([created, file])).toBe(file);
    expect(leadEvent([created])).toBe(created);
  });
});
