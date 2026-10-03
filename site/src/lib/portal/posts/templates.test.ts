import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import { presetEnd } from "./presets";
import { checkPost, toLocalInput } from "./schema";
import { TEMPLATES } from "./templates";

// Monday, October 5, 2026 at 9 AM in Los Angeles.
const now = laInstant("2026-10-05", "09:00");

describe("TEMPLATES", () => {
  it("offers a cancellation, merch back in stock, and a special event", () => {
    expect(TEMPLATES.map((template) => template.label)).toEqual([
      "Cancellation",
      "Merch back in stock",
      "Special event",
    ]);
  });

  it("fills in a heads-up that passes the composer's checks", () => {
    for (const template of TEMPLATES) {
      const endsAt = toLocalInput(presetEnd(template.preset, now));
      const result = checkPost({ ...template.values, startsAt: "", endsAt }, { now });

      expect(result.ok, template.label).toBe(true);
    }
  });

  it("marks the cancellation as a change of plans that lasts tonight", () => {
    const cancellation = TEMPLATES.find((template) => template.id === "cancellation");

    expect(cancellation?.values.tone).toBe("cancellation");
    expect(cancellation?.preset).toBe("tonight");
  });
});
