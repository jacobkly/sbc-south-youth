import { describe, expect, it } from "vitest";
import type { MessageRow } from "./list";
import { applyTriage, planTriage, triagedMessage } from "./triage";

const LEADER = "00000000-0000-4000-8000-0000000000aa";
const ME = "00000000-0000-4000-8000-0000000000bb";
const NOW = new Date("2026-10-03T17:00:00Z");

const message = (changes: Partial<MessageRow> = {}): MessageRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  kind: "serve",
  name: "Sid Example",
  email: "sid@example.test",
  phone: null,
  message: null,
  details: { areas: ["media"] },
  env: "production",
  status: "new",
  outcome: null,
  assigned_to: null,
  internal_note: null,
  handled_by: null,
  handled_at: null,
  notified_at: null,
  created_at: "2026-10-02T22:14:00Z",
  ...changes,
});

describe("planTriage", () => {
  it("sends only what changed", () => {
    expect(planTriage(message(), { status: "handled", assigned_to: null, internal_note: "" })).toEqual({
      kind: "save",
      changes: { status: "handled" },
    });
  });

  it("does nothing when nothing changed", () => {
    expect(planTriage(message({ internal_note: "Called Sunday" }), { internal_note: "  Called Sunday \n" })).toEqual({
      kind: "same",
    });
  });

  it("trims the note, and a blank one clears it", () => {
    expect(planTriage(message(), { internal_note: "  Left a voicemail  " })).toEqual({
      kind: "save",
      changes: { internal_note: "Left a voicemail" },
    });
    expect(planTriage(message({ internal_note: "Old" }), { internal_note: "   " })).toEqual({
      kind: "save",
      changes: { internal_note: null },
    });
  });

  it("takes an outcome on a serve message, and clears one", () => {
    expect(planTriage(message(), { outcome: "placed" })).toEqual({ kind: "save", changes: { outcome: "placed" } });
    expect(planTriage(message({ outcome: "placed" }), { outcome: null })).toEqual({
      kind: "save",
      changes: { outcome: null },
    });
  });

  it("refuses an outcome on any other message", () => {
    expect(planTriage(message({ kind: "visit", details: {} }), { outcome: "not_now" })).toEqual({
      kind: "refuse",
      message: "Only a serve message has an outcome.",
    });
  });

  it("refuses a note over 2,000 characters", () => {
    expect(planTriage(message(), { internal_note: "a".repeat(2001) })).toEqual({
      kind: "refuse",
      message: "Keep the note under 2,000 characters.",
    });
  });

  it("refuses anything that isn't on the lists", () => {
    const refusal = { kind: "refuse", message: "Choose a status, outcome, or leader from the list." };
    expect(planTriage(message(), { status: "archived" })).toEqual(refusal);
    expect(planTriage(message(), { assigned_to: "someone" })).toEqual(refusal);
    expect(planTriage(message(), { name: "Changed" })).toEqual(refusal);
    expect(planTriage(message(), "handled")).toEqual(refusal);
  });

  it("matches a leader's ID in any case", () => {
    expect(planTriage(message({ assigned_to: LEADER }), { assigned_to: LEADER.toUpperCase() })).toEqual({
      kind: "same",
    });
  });
});

describe("applyTriage", () => {
  it("closes a message as the person who did it, now", () => {
    expect(applyTriage(message(), { status: "handled" }, ME, NOW)).toMatchObject({
      status: "handled",
      handled_by: ME,
      handled_at: NOW.toISOString(),
    });
  });

  it("keeps who closed it until someone closes it a different way", () => {
    const closed = message({ status: "handled", handled_by: LEADER, handled_at: "2026-10-03T01:00:00Z" });
    expect(applyTriage(closed, { status: "handled" }, ME, NOW)).toMatchObject({ handled_by: LEADER });
    expect(applyTriage(closed, { status: "spam" }, ME, NOW)).toMatchObject({ status: "spam", handled_by: ME });
  });

  it("clears who closed it when it opens again", () => {
    const closed = message({ status: "handled", handled_by: LEADER, handled_at: "2026-10-03T01:00:00Z" });
    expect(applyTriage(closed, { status: "in_progress" }, ME, NOW)).toMatchObject({
      status: "in_progress",
      handled_by: null,
      handled_at: null,
    });
  });

  it("changes the assignment, outcome, and note as asked", () => {
    expect(applyTriage(message(), { assigned_to: LEADER, outcome: "placed", internal_note: "Tech team" }, ME, NOW))
      .toMatchObject({ assigned_to: LEADER, outcome: "placed", internal_note: "Tech team", status: "new" });
  });
});

describe("triagedMessage", () => {
  const names = new Map([[LEADER, "Avery Leader"]]);

  it("says what happened to the status", () => {
    expect(triagedMessage({ status: "handled" }, names, ME)).toBe("Marked handled.");
    expect(triagedMessage({ status: "in_progress" }, names, ME)).toBe("Moved to In progress.");
    expect(triagedMessage({ status: "new" }, names, ME)).toBe("Moved back to New.");
    expect(triagedMessage({ status: "spam" }, names, ME)).toBe("Marked as spam.");
  });

  it("names who it's assigned to", () => {
    expect(triagedMessage({ assigned_to: LEADER }, names, ME)).toBe("Assigned to Avery Leader.");
    expect(triagedMessage({ assigned_to: ME }, names, ME)).toBe("Assigned to you.");
    expect(triagedMessage({ assigned_to: null }, names, ME)).toBe("Nobody has it now.");
  });

  it("confirms the outcome and the note", () => {
    expect(triagedMessage({ outcome: "placed" }, names, ME)).toBe("Saved the outcome.");
    expect(triagedMessage({ internal_note: "Called" }, names, ME)).toBe("Saved the note.");
    expect(triagedMessage({ internal_note: null }, names, ME)).toBe("Cleared the note.");
  });
});
