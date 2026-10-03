import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import {
  againValues,
  formValues,
  planEnd,
  planRemove,
  planSave,
  planUnschedule,
  savedMessage,
  type ExistingPost,
} from "./save";

// Monday, October 5, 2026 at 9 AM in Los Angeles.
const now = laInstant("2026-10-05", "09:00");

const values = {
  title: "No youth tonight",
  body: "We're taking tonight off.",
  linkUrl: "",
  linkLabel: "",
  tone: "cancellation",
  pinned: true,
  startsAt: "",
  endsAt: "2026-10-05T23:59",
};

function post(status: ExistingPost["status"], starts_at: string, ends_at: string): ExistingPost {
  return { status, starts_at, ends_at };
}

const live = post("published", "2026-10-04T16:00:00.000Z", "2026-10-09T06:59:00.000Z");
const scheduled = post("published", "2026-10-08T16:00:00.000Z", "2026-10-09T06:59:00.000Z");
const draft = post("draft", "2026-10-01T16:00:00.000Z", "2026-10-08T16:00:00.000Z");
const past = post("published", "2026-09-20T16:00:00.000Z", "2026-09-27T06:59:00.000Z");

describe("planSave", () => {
  it("publishes a new heads-up now when it has no start", () => {
    const plan = planSave(values, "publish", null, now);

    expect(plan).toMatchObject({
      kind: "write",
      state: "live",
      row: { status: "published", starts_at: now.toISOString(), tone: "cancellation", pinned: true },
    });
  });

  it("schedules one with a later start", () => {
    const plan = planSave({ ...values, startsAt: "2026-10-05T18:00" }, "publish", null, now);

    expect(plan).toMatchObject({ kind: "write", state: "scheduled", row: { status: "published" } });
  });

  it("saves a draft without putting it up", () => {
    expect(planSave(values, "draft", null, now)).toMatchObject({
      kind: "write",
      state: "draft",
      row: { status: "draft" },
    });
  });

  it("keeps a live heads-up's start when its start is left blank", () => {
    const plan = planSave(values, "publish", live, now);

    expect(plan).toMatchObject({ kind: "write", state: "live", row: { starts_at: live.starts_at } });
  });

  it("won't quietly move a live heads-up's start later, which would take it down", () => {
    const plan = planSave({ ...values, startsAt: "2026-10-05T18:00" }, "publish", live, now);

    expect(plan).toMatchObject({ kind: "write", state: "live", row: { starts_at: live.starts_at } });
  });

  it("starts a scheduled or draft heads-up now when its start is cleared", () => {
    for (const existing of [scheduled, draft]) {
      expect(planSave(values, "publish", existing, now)).toMatchObject({ row: { starts_at: now.toISOString() } });
    }
  });

  it("moves a scheduled heads-up back to drafts", () => {
    const later = { ...values, startsAt: "2026-10-08T09:00", endsAt: "2026-10-08T23:59" };

    expect(planSave(later, "draft", scheduled, now)).toMatchObject({
      kind: "write",
      state: "draft",
    });
  });

  it("won't quietly take a live heads-up down as a draft", () => {
    expect(planSave(values, "draft", live, now)).toEqual({
      kind: "refuse",
      message: "It's up on the site now. Save your changes, or end it to take it down.",
    });
  });

  it("won't change one that has already come down", () => {
    expect(planSave(values, "publish", past, now)).toEqual({
      kind: "refuse",
      message: "This heads-up has already come down. Post it again to put it back up.",
    });
  });

  it("hands back the composer's problems", () => {
    const plan = planSave({ ...values, title: " " }, "publish", null, now);

    expect(plan).toEqual({ kind: "invalid", errors: { title: "Give it a title." } });
  });
});

describe("planEnd", () => {
  it("ends a live heads-up now", () => {
    expect(planEnd(live, now)).toEqual({ kind: "write", row: { ends_at: now.toISOString() } });
  });

  it("only ends one that's up", () => {
    expect(planEnd(scheduled, now)).toMatchObject({ kind: "refuse" });
    expect(planEnd(draft, now)).toMatchObject({ kind: "refuse" });
    expect(planEnd(past, now)).toEqual({ kind: "refuse", message: "It has already come down." });
  });
});

describe("planUnschedule", () => {
  it("moves a scheduled heads-up to drafts", () => {
    expect(planUnschedule(scheduled, now)).toEqual({ kind: "write", row: { status: "draft" } });
  });

  it("leaves a live one for End now", () => {
    expect(planUnschedule(live, now)).toEqual({
      kind: "refuse",
      message: "It's up on the site now. End it to take it down.",
    });
  });
});

describe("planRemove", () => {
  it("deletes only drafts", () => {
    expect(planRemove(draft, now)).toEqual({ kind: "delete" });
    expect(planRemove(live, now)).toEqual({
      kind: "refuse",
      message: "Only a draft can be deleted. End this one instead.",
    });
  });
});

describe("savedMessage", () => {
  const row: ExistingPost = { status: "published", starts_at: now.toISOString(), ends_at: "2026-10-06T06:59:00.000Z" };

  it("says where the heads-up stands now", () => {
    expect(savedMessage(row, now, true)).toBe("Posted. It's on the site now, until today at 11:59 PM.");
    expect(savedMessage({ ...row, starts_at: "2026-10-06T01:00:00.000Z" }, now, true)).toBe(
      "Scheduled. It goes up today at 6:00 PM.",
    );
    expect(savedMessage({ ...row, status: "draft" }, now, true)).toBe("Saved as a draft. Nobody sees it yet.");
  });

  it("says saved, not posted, for a change to one that was already up", () => {
    expect(savedMessage(row, now, false)).toBe("Saved. It's on the site now, until today at 11:59 PM.");
  });
});

describe("formValues", () => {
  const row = {
    id: "00000000-0000-4000-8000-00000000d001",
    title: "Merch is back in stock",
    body: "Grab yours.",
    tone: "info" as const,
    pinned: false,
    link_url: "/this-week",
    link_label: null,
    updated_at: "2026-10-04T16:00:00.000Z",
  };

  it("starts a new heads-up blank, up now through the end of the week", () => {
    expect(formValues(null, now)).toEqual({
      title: "",
      body: "",
      linkUrl: "",
      linkLabel: "",
      tone: "info",
      pinned: false,
      startsAt: "",
      endsAt: "2026-10-11T23:59",
    });
  });

  it("leaves a live heads-up's start blank, so saving keeps it", () => {
    expect(formValues({ ...row, ...live }, now)).toMatchObject({
      title: "Merch is back in stock",
      linkUrl: "/this-week",
      linkLabel: "",
      startsAt: "",
      endsAt: "2026-10-08T23:59",
    });
  });

  it("shows a scheduled heads-up's start", () => {
    expect(formValues({ ...row, ...scheduled }, now).startsAt).toBe("2026-10-08T09:00");
  });

  it("starts a draft now unless it was set for later", () => {
    expect(formValues({ ...row, ...draft }, now).startsAt).toBe("");
    expect(formValues({ ...row, ...draft, starts_at: scheduled.starts_at }, now).startsAt).toBe("2026-10-08T09:00");
  });

  it("moves a draft's passed end to the end of this week", () => {
    expect(formValues({ ...row, ...draft, ends_at: "2026-10-02T06:59:00.000Z" }, now).endsAt).toBe(
      "2026-10-11T23:59",
    );
  });
});

describe("againValues", () => {
  it("copies what it said, and puts it up now through the end of the week", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000d002",
      title: "No youth tonight",
      body: "See you next time!",
      tone: "cancellation" as const,
      pinned: true,
      link_url: null,
      link_label: null,
      updated_at: past.ends_at,
      ...past,
    };

    expect(againValues(row, now)).toEqual({
      title: "No youth tonight",
      body: "See you next time!",
      linkUrl: "",
      linkLabel: "",
      tone: "cancellation",
      pinned: true,
      startsAt: "",
      endsAt: "2026-10-11T23:59",
    });
  });
});
