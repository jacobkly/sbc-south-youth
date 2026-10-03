import { describe, expect, it } from "vitest";
import { eventDescription } from "./event-view";

const view = { date: "Friday, October 16", time: "5 PM", locationName: "Camp Example" };

describe("eventDescription", () => {
  it("gives the facts, then the short description", () => {
    expect(eventDescription({ ...view, summary: "Three days away." })).toBe(
      "Friday, October 16 · 5 PM · Camp Example. Three days away.",
    );
  });

  it("is only the facts without a short description", () => {
    expect(eventDescription(view)).toBe("Friday, October 16 · 5 PM · Camp Example");
  });

  it("says first when it's called off", () => {
    expect(eventDescription({ ...view, cancelled: {}, summary: "Three days away." })).toBe(
      "Cancelled · Friday, October 16 · 5 PM · Camp Example. Three days away.",
    );
  });
});
