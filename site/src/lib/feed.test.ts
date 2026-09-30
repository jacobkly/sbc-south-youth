import { describe, expect, it } from "vitest";
import type { Announcement, SiteEvent, WeeklyGathering } from "./content/types";
import {
  countdownItems,
  eventItem,
  featuredItems,
  groupAgenda,
  itemAddress,
  itemDateLabel,
  itemTimeLabel,
  liveAnnouncements,
  relativeDay,
  upcomingItems,
  whenLabels,
  type FeedItem,
} from "./feed";

const wednesdayNight: WeeklyGathering = {
  slug: "weekly-night",
  title: "Youth Night",
  weekday: 3,
  startTime: "19:00",
  endTime: "21:00",
  locationName: "Youth Room",
  description: "Worship and a message, then food and hanging out.",
};

const sundayMorning: WeeklyGathering = {
  ...wednesdayNight,
  slug: "weekly-sunday",
  title: "Sunday Class",
  weekday: 0,
  startTime: "09:00",
  endTime: "10:30",
};

function event(overrides: Partial<SiteEvent> & Pick<SiteEvent, "startsAt" | "endsAt">): SiteEvent {
  return {
    id: overrides.slug ?? "e1",
    slug: "test-event",
    title: "Test Event",
    allDay: false,
    featured: false,
    ...overrides,
  };
}

function announcement(overrides: Partial<Announcement> & Pick<Announcement, "id">): Announcement {
  return {
    title: `Announcement ${overrides.id}`,
    body: "Body.",
    pinned: false,
    publishAt: "2026-10-01T09:00:00-07:00",
    expiresAt: "2026-10-31T00:00:00-07:00",
    ...overrides,
  };
}

const at = (instant: string) => new Date(instant);
const starts = (items: FeedItem[]) => items.map((item) => item.startsAt);

describe("upcomingItems: weekly gatherings", () => {
  it("keeps 7 PM through the week daylight saving ends", () => {
    // Clocks fall back on Sunday, Nov 1, 2026: PDT (-7) to PST (-8).
    const items = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-10-28T12:00:00-07:00"), days: 14 });
    expect(starts(items)).toEqual([
      "2026-10-29T02:00:00.000Z",
      "2026-11-05T03:00:00.000Z",
      "2026-11-12T03:00:00.000Z",
    ]);
    expect(items.map((item) => item.endsAt)).toEqual([
      "2026-10-29T04:00:00.000Z",
      "2026-11-05T05:00:00.000Z",
      "2026-11-12T05:00:00.000Z",
    ]);
    expect(items.map((item) => item.date)).toEqual(["2026-10-28", "2026-11-04", "2026-11-11"]);
  });

  it("keeps 7 PM through the week daylight saving starts", () => {
    // Clocks spring forward on Sunday, Mar 8, 2026: PST (-8) to PDT (-7).
    const items = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-03-04T12:00:00-08:00"), days: 7 });
    expect(starts(items)).toEqual(["2026-03-05T03:00:00.000Z", "2026-03-12T02:00:00.000Z"]);
  });

  it("uses the new offset on the day the clocks change", () => {
    const fallBack = upcomingItems({ gatherings: [sundayMorning], events: [], now: at("2026-11-01T00:00:00-07:00"), days: 0 });
    expect(starts(fallBack)).toEqual(["2026-11-01T17:00:00.000Z"]);
    const springForward = upcomingItems({ gatherings: [sundayMorning], events: [], now: at("2026-03-08T00:00:00-08:00"), days: 0 });
    expect(starts(springForward)).toEqual(["2026-03-08T16:00:00.000Z"]);
  });

  it("gives each night its own key and links to the gathering", () => {
    const [first, second] = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-09-28T12:00:00-07:00"), days: 14 });
    expect(first).toMatchObject({ kind: "gathering", key: "weekly-night@2026-09-30", slug: "weekly-night", featured: false });
    expect(second.key).toBe("weekly-night@2026-10-07");
  });

  it("keeps tonight's night until it ends", () => {
    const during = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-09-30T20:59:00-07:00"), days: 7 });
    expect(during[0].date).toBe("2026-09-30");
    const after = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-09-30T21:00:00-07:00"), days: 7 });
    expect(after[0].date).toBe("2026-10-07");
  });
});

describe("upcomingItems: events", () => {
  const now = at("2026-10-07T18:00:00-07:00");

  it("drops an event that ends exactly now and keeps one ending a second later", () => {
    const ended = event({ slug: "ended", startsAt: "2026-10-07T16:00:00-07:00", endsAt: "2026-10-07T18:00:00-07:00" });
    const ending = event({ slug: "ending", startsAt: "2026-10-07T16:00:00-07:00", endsAt: "2026-10-07T18:00:01-07:00" });
    const items = upcomingItems({ gatherings: [], events: [ended, ending], now });
    expect(items.map((item) => item.slug)).toEqual(["ending"]);
  });

  it("keeps an event that starts exactly now", () => {
    const starting = event({ startsAt: "2026-10-07T18:00:00-07:00", endsAt: "2026-10-07T20:00:00-07:00" });
    expect(upcomingItems({ gatherings: [], events: [starting], now })).toHaveLength(1);
  });

  it("looks 8 weeks ahead by default", () => {
    const lastDay = event({ slug: "last-day", startsAt: "2026-12-02T23:00:00-08:00", endsAt: "2026-12-02T23:30:00-08:00" });
    const tooFar = event({ slug: "too-far", startsAt: "2026-12-03T00:00:00-08:00", endsAt: "2026-12-03T01:00:00-08:00" });
    const items = upcomingItems({ gatherings: [], events: [lastDay, tooFar], now });
    expect(items.map((item) => item.slug)).toEqual(["last-day"]);
  });

  it("merges events with gatherings in start order, then by title", () => {
    const dinner = event({ slug: "dinner", title: "Dinner", startsAt: "2026-10-07T19:00:00-07:00", endsAt: "2026-10-07T20:00:00-07:00" });
    const early = event({ slug: "early", title: "Early", startsAt: "2026-10-07T18:30:00-07:00", endsAt: "2026-10-07T19:00:00-07:00" });
    const items = upcomingItems({ gatherings: [wednesdayNight], events: [dinner, early], now, days: 0 });
    expect(items.map((item) => item.title)).toEqual(["Early", "Dinner", "Youth Night"]);
    expect(items[0]).toMatchObject({ kind: "event", key: "early", date: "2026-10-07" });
  });

  it("dates an event by the day it starts in Los Angeles", () => {
    const late = event({ startsAt: "2026-10-10T05:30:00Z", endsAt: "2026-10-10T06:30:00Z" });
    expect(upcomingItems({ gatherings: [], events: [late], now })[0].date).toBe("2026-10-09");
  });
});

describe("featuredItems", () => {
  const now = at("2026-10-07T18:00:00-07:00");
  const retreat = event({
    slug: "retreat",
    featured: true,
    startsAt: "2026-10-16T17:00:00-07:00",
    endsAt: "2026-10-18T12:00:00-07:00",
  });

  it("keeps only featured events, soonest first", () => {
    const worship = event({ slug: "worship", featured: true, startsAt: "2026-10-09T19:00:00-07:00", endsAt: "2026-10-09T21:00:00-07:00" });
    const plain = event({ slug: "plain", startsAt: "2026-10-08T19:00:00-07:00", endsAt: "2026-10-08T21:00:00-07:00" });
    expect(featuredItems([retreat, plain, worship], now).map((item) => item.slug)).toEqual(["worship", "retreat"]);
  });

  it("keeps one that's underway and drops one that's over", () => {
    const underway = event({ slug: "underway", featured: true, startsAt: "2026-10-07T17:00:00-07:00", endsAt: "2026-10-07T19:00:00-07:00" });
    const over = event({ slug: "over", featured: true, startsAt: "2026-10-07T15:00:00-07:00", endsAt: "2026-10-07T17:00:00-07:00" });
    expect(featuredItems([over, underway, retreat], now).map((item) => item.slug)).toEqual(["underway", "retreat"]);
  });

  it("looks as far ahead as the agenda", () => {
    const tooFar = event({ slug: "too-far", featured: true, startsAt: "2026-12-03T19:00:00-08:00", endsAt: "2026-12-03T21:00:00-08:00" });
    expect(featuredItems([tooFar, retreat], now).map((item) => item.slug)).toEqual(["retreat"]);
  });
});

describe("countdownItems", () => {
  const now = at("2026-10-07T18:00:00-07:00");
  const retreat = event({
    slug: "retreat",
    featured: true,
    startsAt: "2026-10-16T17:00:00-07:00",
    endsAt: "2026-10-18T12:00:00-07:00",
  });

  it("counts down to the next weekly night when nothing is featured", () => {
    const plain = event({ slug: "plain", startsAt: "2026-10-08T19:00:00-07:00", endsAt: "2026-10-08T21:00:00-07:00" });
    const items = countdownItems({ events: [plain], gatherings: [wednesdayNight], now, spares: 2 });
    expect(items.map((item) => `${item.slug} ${item.date}`)).toEqual(["weekly-night 2026-10-07", "weekly-night 2026-10-14"]);
  });

  it("puts featured events before the weekly nights, even later ones", () => {
    const items = countdownItems({ events: [retreat], gatherings: [wednesdayNight], now, spares: 2 });
    expect(items.map((item) => `${item.slug} ${item.date}`)).toEqual([
      "retreat 2026-10-16",
      "weekly-night 2026-10-07",
      "weekly-night 2026-10-14",
    ]);
  });

  it("sends only a few of each", () => {
    const worship = event({ slug: "worship", featured: true, startsAt: "2026-10-09T19:00:00-07:00", endsAt: "2026-10-09T21:00:00-07:00" });
    const items = countdownItems({ events: [retreat, worship], gatherings: [wednesdayNight], now, spares: 1 });
    expect(items.map((item) => item.slug)).toEqual(["worship", "weekly-night"]);
  });
});

describe("relativeDay", () => {
  // Wednesday, Sep 30, 7–9 PM.
  const night = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-09-28T12:00:00-07:00") })[0];

  it("is now from the moment it starts", () => {
    expect(relativeDay(night, at("2026-09-30T18:59:59-07:00"))).toBe("today");
    expect(relativeDay(night, at("2026-09-30T19:00:00-07:00"))).toBe("now");
    expect(relativeDay(night, at("2026-09-30T20:30:00-07:00"))).toBe("now");
  });

  it("goes by the day in Los Angeles", () => {
    // 11:30 PM Tuesday in LA is already Wednesday in UTC.
    expect(relativeDay(night, at("2026-09-29T23:30:00-07:00"))).toBe("tomorrow");
    expect(relativeDay(night, at("2026-09-30T00:00:00-07:00"))).toBe("today");
    expect(relativeDay(night, at("2026-09-28T23:59:00-07:00"))).toBe("");
  });

  it("is now for an event that started days ago and hasn't ended", () => {
    const retreat = eventItem(
      event({ startsAt: "2026-10-09T17:00:00-07:00", endsAt: "2026-10-11T12:00:00-07:00" }),
    );
    expect(relativeDay(retreat, at("2026-10-10T09:00:00-07:00"))).toBe("now");
  });
});

describe("whenLabels", () => {
  const night = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-09-28T12:00:00-07:00") })[0];

  it("says tonight for evening plans", () => {
    expect(whenLabels(night, "2026-09-28")).toEqual({
      now: "Happening now",
      today: "Tonight",
      tomorrow: "Tomorrow night",
      later: "Wednesday",
    });
  });

  it("says today for daytime plans and dates anything a week or more out", () => {
    const serve = eventItem(event({ startsAt: "2026-10-10T09:00:00-07:00", endsAt: "2026-10-10T12:00:00-07:00" }));
    expect(whenLabels(serve, "2026-09-29")).toMatchObject({ today: "Today", tomorrow: "Tomorrow", later: "Sat, Oct 10" });
    expect(whenLabels(serve, "2026-10-04").later).toBe("Saturday");
    expect(whenLabels(serve, "2026-10-03").later).toBe("Sat, Oct 10");
  });

  it("never says tonight for an all-day event", () => {
    const beach = eventItem(
      event({ allDay: true, startsAt: "2026-10-17T00:00:00-07:00", endsAt: "2026-10-18T00:00:00-07:00" }),
    );
    expect(whenLabels(beach, "2026-10-16")).toMatchObject({ today: "Today", tomorrow: "Tomorrow" });
  });
});

describe("itemAddress", () => {
  const church = "123 Example Street, Anytown, CA 00000";
  const base = { startsAt: "2026-10-10T09:00:00-07:00", endsAt: "2026-10-10T12:00:00-07:00" };

  it("uses the place's own address", () => {
    const item = eventItem(event({ ...base, locationName: "Beach", locationAddress: "1 Example Coast Highway" }));
    expect(itemAddress(item, church)).toBe("1 Example Coast Highway");
  });

  it("uses the church's address for a room at the church", () => {
    const night = upcomingItems({ gatherings: [wednesdayNight], events: [], now: at("2026-09-28T12:00:00-07:00") })[0];
    expect(itemAddress(night, church)).toBe(church);
  });

  it("uses the church's address for a weekly night without a room", () => {
    const noRoom = { ...wednesdayNight, locationName: undefined };
    const night = upcomingItems({ gatherings: [noRoom], events: [], now: at("2026-09-28T12:00:00-07:00") })[0];
    expect(itemAddress(night, church)).toBe(church);
  });

  it("has nothing to give when there's no place", () => {
    expect(itemAddress(eventItem(event(base)), church)).toBeUndefined();
  });
});

describe("groupAgenda", () => {
  // Sunday, Oct 4 through Sunday, Oct 11, 2026.
  const events = [
    event({ slug: "sunday-late", startsAt: "2026-10-04T20:00:00-07:00", endsAt: "2026-10-04T23:45:00-07:00" }),
    event({ slug: "next-sunday", startsAt: "2026-10-11T12:00:00-07:00", endsAt: "2026-10-11T13:00:00-07:00" }),
    event({ slug: "monday-after", startsAt: "2026-10-12T19:00:00-07:00", endsAt: "2026-10-12T20:00:00-07:00" }),
  ];

  function agenda(now: Date) {
    const items = upcomingItems({ gatherings: [wednesdayNight], events, now, days: 13 });
    return Object.fromEntries(
      groupAgenda(items, now).map((group) => [group.id, group.days.flatMap((day) => day.items.map((item) => item.key))]),
    );
  }

  it("ends the week at Sunday midnight", () => {
    expect(agenda(at("2026-10-04T23:30:00-07:00"))).toEqual({
      "this-week": ["sunday-late"],
      "next-week": ["weekly-night@2026-10-07", "next-sunday"],
      // Weekly nights would repeat all the way down, so Coming up skips them.
      "coming-up": ["monday-after"],
    });
    expect(agenda(at("2026-10-05T00:00:00-07:00"))).toEqual({
      "this-week": ["weekly-night@2026-10-07", "next-sunday"],
      "next-week": ["monday-after", "weekly-night@2026-10-14"],
    });
  });

  it("titles the groups and leaves out empty ones", () => {
    const now = at("2026-10-05T09:00:00-07:00");
    const groups = groupAgenda(upcomingItems({ gatherings: [wednesdayNight], events: [], now, days: 9 }), now);
    expect(groups.map((group) => [group.id, group.title, group.from, group.through])).toEqual([
      ["this-week", "This week", "2026-10-05", "2026-10-11"],
      ["next-week", "Next week", "2026-10-12", "2026-10-18"],
    ]);
    expect(groupAgenda([], now)).toEqual([]);
  });

  it("groups items by day within a week", () => {
    const dinner = event({ slug: "dinner", startsAt: "2026-10-07T17:00:00-07:00", endsAt: "2026-10-07T18:30:00-07:00" });
    const now = at("2026-10-05T09:00:00-07:00");
    const [thisWeek] = groupAgenda(upcomingItems({ gatherings: [wednesdayNight], events: [dinner], now, days: 6 }), now);
    expect(thisWeek.days).toHaveLength(1);
    expect(thisWeek.days[0].date).toBe("2026-10-07");
    expect(thisWeek.days[0].items.map((item) => item.slug)).toEqual(["dinner", "weekly-night"]);
  });

  it("puts an event that's already underway under today", () => {
    const retreat = event({ slug: "retreat", startsAt: "2026-10-02T17:00:00-07:00", endsAt: "2026-10-04T12:00:00-07:00" });
    const now = at("2026-10-03T10:00:00-07:00");
    const [thisWeek] = groupAgenda(upcomingItems({ gatherings: [], events: [retreat], now }), now);
    expect(thisWeek.id).toBe("this-week");
    expect(thisWeek.days[0].date).toBe("2026-10-03");
    expect(thisWeek.days[0].items[0].date).toBe("2026-10-02");
  });
});

describe("liveAnnouncements", () => {
  const now = at("2026-10-10T12:00:00-07:00");

  it("leaves out expired and scheduled posts", () => {
    const list = [
      announcement({ id: "live" }),
      announcement({ id: "expired", expiresAt: "2026-10-10T11:59:59-07:00" }),
      announcement({ id: "expires-now", expiresAt: "2026-10-10T12:00:00-07:00" }),
      announcement({ id: "scheduled", publishAt: "2026-10-10T12:00:01-07:00" }),
      announcement({ id: "publishes-now", publishAt: "2026-10-10T12:00:00-07:00" }),
    ];
    expect(liveAnnouncements(list, now).map((item) => item.id).sort()).toEqual(["live", "publishes-now"]);
  });

  it("puts pinned posts first, then the newest", () => {
    const list = [
      announcement({ id: "old", publishAt: "2026-10-01T09:00:00-07:00" }),
      announcement({ id: "new", publishAt: "2026-10-09T09:00:00-07:00" }),
      announcement({ id: "pinned-old", pinned: true, publishAt: "2026-09-20T09:00:00-07:00" }),
      announcement({ id: "pinned-new", pinned: true, publishAt: "2026-10-05T09:00:00-07:00" }),
    ];
    expect(liveAnnouncements(list, now).map((item) => item.id)).toEqual(["pinned-new", "pinned-old", "new", "old"]);
  });
});

describe("itemTimeLabel", () => {
  const item = (startsAt: string, endsAt: string, allDay = false) =>
    upcomingItems({ gatherings: [], events: [event({ startsAt, endsAt, allDay })], now: at("2026-10-01T00:00:00-07:00") })[0];

  it("gives a range on one day", () => {
    expect(itemTimeLabel(item("2026-10-07T19:00:00-07:00", "2026-10-07T21:00:00-07:00"))).toBe("7–9 PM");
    expect(itemTimeLabel(item("2026-10-07T11:30:00-07:00", "2026-10-07T13:00:00-07:00"))).toBe("11:30 AM–1 PM");
  });

  it("names the days when it runs past midnight", () => {
    expect(itemTimeLabel(item("2026-10-09T17:00:00-07:00", "2026-10-11T12:00:00-07:00"))).toBe("Fri 5 PM – Sun 12 PM");
    expect(itemTimeLabel(item("2026-10-10T20:00:00-07:00", "2026-10-11T08:00:00-07:00"))).toBe("Sat 8 PM – Sun 8 AM");
  });

  it("says all day, or through the last day", () => {
    expect(itemTimeLabel(item("2026-10-17T00:00:00-07:00", "2026-10-18T00:00:00-07:00", true))).toBe("All day");
    expect(itemTimeLabel(item("2026-10-16T00:00:00-07:00", "2026-10-19T00:00:00-07:00", true))).toBe("All day, Fri–Sun");
  });
});

describe("itemDateLabel", () => {
  const today = "2026-10-01";
  const item = (startsAt: string, endsAt: string, allDay = false) =>
    upcomingItems({ gatherings: [], events: [event({ startsAt, endsAt, allDay })], now: at("2026-10-01T00:00:00-07:00") })[0];

  it("spells out a single day", () => {
    expect(itemDateLabel(item("2026-10-10T09:00:00-07:00", "2026-10-10T12:00:00-07:00"), today)).toBe("Saturday, October 10");
    expect(itemDateLabel(item("2026-10-17T00:00:00-07:00", "2026-10-18T00:00:00-07:00", true), today)).toBe(
      "Saturday, October 17",
    );
  });

  it("gives the first and last day of a longer event", () => {
    expect(itemDateLabel(item("2026-10-09T17:00:00-07:00", "2026-10-11T12:00:00-07:00"), today)).toBe(
      "Fri, Oct 9 – Sun, Oct 11",
    );
    expect(itemDateLabel(item("2026-10-16T00:00:00-07:00", "2026-10-19T00:00:00-07:00", true), today)).toBe(
      "Fri, Oct 16 – Sun, Oct 18",
    );
  });
});
