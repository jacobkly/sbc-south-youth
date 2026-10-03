import { describe, expect, it } from "vitest";
import { laInstant, laMidnight } from "@/lib/dates";
import type { EventRow } from "./list";
import {
  copyValues,
  formValues,
  planCancel,
  planRemove,
  planRestore,
  planSave,
  savedMessage,
  type ExistingEvent,
} from "./save";

// Wednesday, October 7, 2026 at 3 PM in Los Angeles.
const now = laInstant("2026-10-07", "15:00");

const values = {
  title: "Worship Night",
  summary: "",
  body: "",
  allDay: false,
  startDate: "2026-11-14",
  startTime: "19:00",
  endDate: "2026-11-14",
  endTime: "21:00",
  locationName: "",
  address: "",
  costNote: "",
  featured: false,
};

const at = (date: string, time: string) => laInstant(date, time).toISOString();

function existing(status: ExistingEvent["status"], starts_at: string, ends_at: string): ExistingEvent {
  return { status, starts_at, ends_at };
}

const draft = existing("draft", at("2026-11-14", "19:00"), at("2026-11-14", "21:00"));
const upcoming = existing("published", at("2026-11-14", "19:00"), at("2026-11-14", "21:00"));
const happening = existing("published", at("2026-10-07", "14:00"), at("2026-10-07", "16:00"));
const cancelled = existing("cancelled", at("2026-11-14", "19:00"), at("2026-11-14", "21:00"));
const past = existing("published", at("2026-10-01", "19:00"), at("2026-10-01", "21:00"));
const pastCancelled = existing("cancelled", at("2026-10-01", "19:00"), at("2026-10-01", "21:00"));

describe("planSave", () => {
  it("publishes a new event and gives it a slug", () => {
    expect(planSave(values, "publish", null, now)).toMatchObject({
      kind: "write",
      state: "upcoming",
      newSlug: true,
      row: { status: "published", title: "Worship Night", starts_at: at("2026-11-14", "19:00") },
    });
  });

  it("saves a new draft, and a draft's slug follows its title until it's published", () => {
    expect(planSave(values, "draft", null, now)).toMatchObject({
      kind: "write",
      state: "draft",
      newSlug: true,
      row: { status: "draft" },
    });
    expect(planSave(values, "draft", draft, now)).toMatchObject({ kind: "write", newSlug: true });
    expect(planSave(values, "publish", draft, now)).toMatchObject({
      kind: "write",
      newSlug: true,
      row: { status: "published" },
    });
  });

  it("keeps a published event's slug, so its link and calendar entry don't move", () => {
    for (const event of [upcoming, happening]) {
      expect(planSave(values, "publish", event, now)).toMatchObject({
        kind: "write",
        newSlug: false,
        row: { status: "published" },
      });
    }
  });

  it("won't take a published event back to a draft", () => {
    expect(planSave(values, "draft", upcoming, now)).toEqual({
      kind: "refuse",
      message: "It's on the site and in calendars. Save your changes, or cancel it.",
    });
  });

  it("leaves a cancelled event alone until it's put back on", () => {
    expect(planSave(values, "publish", cancelled, now)).toEqual({
      kind: "refuse",
      message: "It's cancelled. Put it back on to change it.",
    });
  });

  it("leaves a past event as it was", () => {
    for (const event of [past, pastCancelled]) {
      expect(planSave(values, "publish", event, now)).toEqual({
        kind: "refuse",
        message: "It's over, so it stays as it was. Make a new one like it instead.",
      });
    }
  });

  it("passes on what's wrong with the form", () => {
    expect(planSave({ ...values, title: "" }, "publish", null, now)).toEqual({
      kind: "invalid",
      errors: { title: "Give it a title." },
    });
  });
});

describe("planCancel", () => {
  it("cancels a coming or happening event with the reason, tidied", () => {
    for (const event of [upcoming, happening]) {
      expect(planCancel(event, "  Rained   out. ", now)).toEqual({
        kind: "write",
        row: { status: "cancelled", cancel_reason: "Rained out." },
      });
    }
  });

  it("lets the reason be blank", () => {
    expect(planCancel(upcoming, "   ", now)).toEqual({
      kind: "write",
      row: { status: "cancelled", cancel_reason: null },
    });
  });

  it("keeps the reason to 200 characters", () => {
    expect(planCancel(upcoming, "a".repeat(200), now)).toMatchObject({ kind: "write" });
    expect(planCancel(upcoming, "a".repeat(201), now)).toEqual({
      kind: "invalid",
      message: "Keep the reason to 200 characters or fewer.",
    });
  });

  it("only cancels an event that went out and isn't over", () => {
    expect(planCancel(draft, "", now)).toEqual({
      kind: "refuse",
      message: "It's a draft, so nobody has seen it. Delete it instead.",
    });
    expect(planCancel(cancelled, "", now)).toEqual({ kind: "refuse", message: "It's already cancelled." });
    expect(planCancel(past, "", now)).toEqual({ kind: "refuse", message: "It's already over." });
  });
});

describe("planRestore", () => {
  it("puts a cancelled event back on and clears the reason", () => {
    expect(planRestore(cancelled, now)).toEqual({
      kind: "write",
      row: { status: "published", cancel_reason: null },
    });
  });

  it("only puts back an event that's cancelled and not over", () => {
    expect(planRestore(pastCancelled, now)).toEqual({ kind: "refuse", message: "It's already over." });
    expect(planRestore(upcoming, now)).toEqual({ kind: "refuse", message: "It isn't cancelled." });
    expect(planRestore(draft, now)).toEqual({ kind: "refuse", message: "It isn't cancelled." });
  });
});

describe("planRemove", () => {
  it("deletes a draft", () => {
    expect(planRemove(draft, now)).toEqual({ kind: "delete" });
  });

  it("keeps anything that went out, so calendars and Activity keep its story", () => {
    expect(planRemove(upcoming, now)).toEqual({
      kind: "refuse",
      message: "Only a draft can be deleted. Cancel this one instead.",
    });
    for (const event of [cancelled, past]) {
      expect(planRemove(event, now)).toEqual({ kind: "refuse", message: "Only a draft can be deleted." });
    }
  });
});

describe("savedMessage", () => {
  it("says where the event is now", () => {
    expect(savedMessage(draft, now, true)).toBe("Saved as a draft. Nobody sees it yet.");
    expect(savedMessage(upcoming, now, true)).toBe(
      "Published. It's on the site now, and subscribed calendars add it the next time they check.",
    );
    expect(savedMessage(happening, now, false)).toBe(
      "Saved. The site shows the change now, and subscribed calendars catch up the next time they check.",
    );
  });
});

const row: EventRow = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "worship-night",
  title: "Worship Night",
  summary: "A night of worship.",
  body: "Come early.",
  starts_at: at("2026-11-14", "19:00"),
  ends_at: at("2026-11-14", "21:00"),
  all_day: false,
  location_name: "Youth room",
  address: null,
  cost_note: "Free",
  featured: true,
  status: "published",
  cancel_reason: null,
  updated_at: now.toISOString(),
};

describe("formValues", () => {
  it("starts a new event blank", () => {
    expect(formValues(null)).toEqual({
      title: "",
      summary: "",
      body: "",
      allDay: false,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      locationName: "",
      address: "",
      costNote: "",
      featured: false,
    });
  });

  it("shows an event as it is, on the Los Angeles clock", () => {
    expect(formValues(row)).toEqual({
      title: "Worship Night",
      summary: "A night of worship.",
      body: "Come early.",
      allDay: false,
      startDate: "2026-11-14",
      startTime: "19:00",
      endDate: "2026-11-14",
      endTime: "21:00",
      locationName: "Youth room",
      address: "",
      costNote: "Free",
      featured: true,
    });
  });

  it("shows an all-day event's last day, not the midnight after it", () => {
    const retreat = {
      ...row,
      all_day: true,
      starts_at: laMidnight("2026-10-30").toISOString(),
      ends_at: laMidnight("2026-11-02").toISOString(),
    };

    expect(formValues(retreat)).toMatchObject({
      allDay: true,
      startDate: "2026-10-30",
      startTime: "",
      endDate: "2026-11-01",
      endTime: "",
    });
  });
});

describe("copyValues", () => {
  it("keeps the words, place, and times, and leaves the dates to pick", () => {
    expect(copyValues(row)).toEqual({
      ...formValues(row),
      startDate: "",
      endDate: "",
    });
  });
});
