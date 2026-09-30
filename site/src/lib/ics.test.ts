import { describe, expect, it } from "vitest";
import type { SiteEvent, WeeklyGathering } from "./content/types";
import { addDays, laInstant, weekdayOf } from "./dates";
import {
  calendarFile,
  escapeText,
  eventEntry,
  foldLine,
  gatheringEntry,
  googleCalendarUrl,
  type CalendarEntry,
} from "./ics";

const stamp = new Date("2026-09-29T16:00:00Z");

const timed: CalendarEntry = {
  id: "e1",
  title: "Serve Saturday",
  when: { kind: "timed", start: "2026-10-10T09:00:00-07:00", end: "2026-10-10T12:00:00-07:00" },
};

const allDay: CalendarEntry = {
  id: "e2",
  title: "Beach Day",
  when: { kind: "all-day", start: "2026-10-17", end: "2026-10-18" },
};

// Starts in October on daylight time and keeps going into standard time.
const weekly: CalendarEntry = {
  id: "weekly-hs",
  title: "High School Youth Night",
  when: { kind: "weekly", date: "2026-10-28", startTime: "19:00", endTime: "21:00" },
};

/** The lines of a file, with folded lines joined back up. */
function unfold(file: string): string[] {
  return file.replace(/\r\n /g, "").split("\r\n");
}

const octets = (text: string) => new TextEncoder().encode(text).length;

describe("escapeText", () => {
  it("escapes backslashes, semicolons, commas, and line breaks", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("leaves colons and quotes alone", () => {
    expect(escapeText('Serve Saturday: "Park" Cleanup')).toBe('Serve Saturday: "Park" Cleanup');
  });
});

describe("foldLine", () => {
  it("leaves a line of 75 octets alone", () => {
    const line = "x".repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it("folds long lines at 75 octets, then 74 after the leading space", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldLine(line).split("\r\n");
    expect(folded[0]).toHaveLength(75);
    expect(folded.slice(1).every((part) => part.startsWith(" ") && octets(part) <= 75)).toBe(true);
    expect(folded.map((part, index) => (index === 0 ? part : part.slice(1))).join("")).toBe(line);
  });

  it("never splits a character that takes more than one octet", () => {
    const line = `SUMMARY:${"é".repeat(40)}${"🔥".repeat(30)}${"日".repeat(30)}`;
    const folded = foldLine(line).split("\r\n");
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) {
      expect(octets(part)).toBeLessThanOrEqual(75);
      // A split character would leave a lone surrogate or a replacement character.
      expect(part.isWellFormed()).toBe(true);
    }
    expect(folded.map((part, index) => (index === 0 ? part : part.slice(1))).join("")).toBe(line);
  });
});

describe("calendarFile", () => {
  it("wraps events in a calendar with CRLF line endings", () => {
    const file = calendarFile([timed], { stamp });
    expect(file.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(file.split("\r\n").every((line) => octets(line) <= 75)).toBe(true);
  });

  it("gives each event a UID on the site's domain and a stamp", () => {
    const lines = unfold(calendarFile([timed], { stamp }));
    expect(lines).toContain("UID:e1@sbcsouthyouth.com");
    expect(lines).toContain("DTSTAMP:20260929T160000Z");
  });

  it("writes one-off times in UTC", () => {
    const lines = unfold(calendarFile([timed], { stamp }));
    expect(lines).toContain("DTSTART:20261010T160000Z");
    expect(lines).toContain("DTEND:20261010T190000Z");
    expect(lines).not.toContain("BEGIN:VTIMEZONE");
  });

  it("writes all-day events as dates, ending the day after", () => {
    const lines = unfold(calendarFile([allDay], { stamp }));
    expect(lines).toContain("DTSTART;VALUE=DATE:20261017");
    expect(lines).toContain("DTEND;VALUE=DATE:20261018");
  });

  it("escapes text and puts the page link after the description", () => {
    const entry: CalendarEntry = {
      ...timed,
      title: "Pizza, games; worship",
      description: "Bring a friend.\nDoors at 6.",
      location: "Youth Room, 123 Example Street",
      url: "https://sbcsouthyouth.com/events/pizza",
    };
    const lines = unfold(calendarFile([entry], { stamp }));
    expect(lines).toContain("SUMMARY:Pizza\\, games\\; worship");
    expect(lines).toContain(
      "DESCRIPTION:Bring a friend.\\nDoors at 6.\\n\\nhttps://sbcsouthyouth.com/events/pizza",
    );
    expect(lines).toContain("LOCATION:Youth Room\\, 123 Example Street");
    expect(lines).toContain("URL:https://sbcsouthyouth.com/events/pizza");
  });

  it("keeps a weekly night at the same LA time across daylight saving", () => {
    const lines = unfold(calendarFile([weekly], { stamp }));
    expect(lines).toContain("DTSTART;TZID=America/Los_Angeles:20261028T190000");
    expect(lines).toContain("DTEND;TZID=America/Los_Angeles:20261028T210000");
    expect(lines).toContain("RRULE:FREQ=WEEKLY");
    // In UTC, 7 PM on Oct 28 would turn into 6 PM once November's clocks fall back.
    expect(lines.filter((line) => line.startsWith("DTSTART")).every((line) => !line.endsWith("Z"))).toBe(true);
    expect(lines.filter((line) => line === "BEGIN:VTIMEZONE")).toHaveLength(1);
    expect(lines).toContain("TZID:America/Los_Angeles");
  });

  it("describes LA's daylight saving rules correctly", () => {
    const lines = unfold(calendarFile([weekly], { stamp }));
    const rule = (part: "DAYLIGHT" | "STANDARD") => {
      const block = lines.slice(lines.indexOf(`BEGIN:${part}`), lines.indexOf(`END:${part}`));
      const field = (name: string) => block.find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1);
      const byDay = /BYMONTH=(\d+);BYDAY=(\d)SU/.exec(field("RRULE") ?? "");
      return { to: field("TZOFFSETTO"), month: Number(byDay?.[1]), nth: Number(byDay?.[2]) };
    };
    const offsetHours = (date: string) => {
      const utc = laInstant(date, "12:00");
      return (Date.parse(`${date}T12:00:00Z`) - utc.getTime()) / 3_600_000;
    };
    const nthSunday = (year: number, month: number, nth: number) => {
      const first = `${year}-${String(month).padStart(2, "0")}-01`;
      return addDays(first, ((7 - weekdayOf(first)) % 7) + (nth - 1) * 7);
    };

    // The rules have to agree with the time zone data for years to come.
    for (const part of ["DAYLIGHT", "STANDARD"] as const) {
      const { to, month, nth } = rule(part);
      expect(to).toBe(part === "DAYLIGHT" ? "-0700" : "-0800");
      for (let year = 2026; year <= 2036; year++) {
        const change = nthSunday(year, month, nth);
        expect(offsetHours(addDays(change, -1))).toBe(part === "DAYLIGHT" ? -8 : -7);
        expect(offsetHours(change)).toBe(part === "DAYLIGHT" ? -7 : -8);
      }
    }
  });

  it("names a feed and tells apps how often to check it", () => {
    const lines = unfold(calendarFile([timed], { stamp, name: "SBC South Youth" }));
    expect(lines).toContain("X-WR-CALNAME:SBC South Youth");
    expect(lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT12H");
    expect(lines).toContain("X-PUBLISHED-TTL:PT12H");
    expect(unfold(calendarFile([timed], { stamp }))).not.toContain("X-WR-CALNAME:SBC South Youth");
  });
});

describe("googleCalendarUrl", () => {
  const params = (entry: CalendarEntry) => new URL(googleCalendarUrl(entry)).searchParams;

  it("uses UTC times for one-off events", () => {
    const query = params({ ...timed, location: "Youth Room", description: "Bring gloves." });
    expect(query.get("action")).toBe("TEMPLATE");
    expect(query.get("text")).toBe("Serve Saturday");
    expect(query.get("dates")).toBe("20261010T160000Z/20261010T190000Z");
    expect(query.get("location")).toBe("Youth Room");
    expect(query.get("details")).toBe("Bring gloves.");
    expect(query.has("recur")).toBe(false);
  });

  it("uses dates for all-day events", () => {
    expect(params(allDay).get("dates")).toBe("20261017/20261018");
  });

  it("repeats weekly nights in LA time", () => {
    const query = params(weekly);
    expect(query.get("dates")).toBe("20261028T190000/20261028T210000");
    expect(query.get("ctz")).toBe("America/Los_Angeles");
    expect(query.get("recur")).toBe("RRULE:FREQ=WEEKLY");
  });
});

describe("content entries", () => {
  const church = "123 Example Street, Anytown, CA 00000";

  const event: SiteEvent = {
    id: "e1",
    slug: "fall-retreat",
    title: "Fall Retreat",
    description: "Two nights away.",
    startsAt: "2026-10-16T17:00:00-07:00",
    endsAt: "2026-10-18T12:00:00-07:00",
    allDay: false,
    locationName: "Example Pines Camp",
    locationAddress: "1 Example Pines Road, Mountainville, CA 00000",
    featured: true,
  };

  const gathering: WeeklyGathering = {
    slug: "weekly-hs",
    title: "High School Youth Night",
    weekday: 3,
    startTime: "19:00",
    endTime: "21:00",
    locationName: "Youth Room",
    description: "Games, worship, and small groups.",
  };

  it("links an event to its page and gives the place with its address", () => {
    const entry = eventEntry(event, church);
    expect(entry).toMatchObject({
      id: "e1",
      url: "https://sbcsouthyouth.com/events/fall-retreat",
      location: "Example Pines Camp, 1 Example Pines Road, Mountainville, CA 00000",
      when: { kind: "timed", start: event.startsAt, end: event.endsAt },
    });
  });

  it("uses the church's address for a room at the church", () => {
    const entry = eventEntry({ ...event, locationName: "Youth Room", locationAddress: undefined }, church);
    expect(entry.location).toBe(`Youth Room, ${church}`);
  });

  it("turns an all-day event into LA dates", () => {
    const entry = eventEntry(
      { ...event, allDay: true, startsAt: "2026-10-17T00:00:00-07:00", endsAt: "2026-10-19T00:00:00-07:00" },
      church,
    );
    expect(entry.when).toEqual({ kind: "all-day", start: "2026-10-17", end: "2026-10-19" });
  });

  it("starts a weekly night on its next date", () => {
    const wednesday = gatheringEntry(gathering, church, laInstant("2026-09-30", "20:00"));
    expect(wednesday.when).toEqual({ kind: "weekly", date: "2026-09-30", startTime: "19:00", endTime: "21:00" });
    const thursday = gatheringEntry(gathering, church, laInstant("2026-10-01", "12:00"));
    expect(thursday.when).toMatchObject({ date: "2026-10-07" });
    expect(thursday).toMatchObject({
      id: "weekly-hs",
      url: "https://sbcsouthyouth.com/events/weekly-hs",
      location: `Youth Room, ${church}`,
      description: "Games, worship, and small groups.",
    });
  });
});
