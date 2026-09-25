import { describe, expect, it } from "vitest";
import { settingsFormValues, settingsSaveErrorMessage, settingsSchema } from "./schema";

const DAYS_MESSAGE = "Enter a whole number of days from 1 to 365.";

function daysError(days: string) {
  const result = settingsSchema.safeParse({ allow_external_approval: true, late_submission_days: days });
  return result.success ? null : result.error.issues[0].message;
}

describe("settingsSchema", () => {
  it("reads the days as a number", () => {
    expect(settingsSchema.parse({ allow_external_approval: false, late_submission_days: " 60 " })).toEqual({
      allow_external_approval: false,
      late_submission_days: 60,
    });
    expect(settingsSchema.parse({ allow_external_approval: true, late_submission_days: "365" }).late_submission_days).toBe(
      365,
    );
    expect(settingsSchema.parse({ allow_external_approval: true, late_submission_days: "1" }).late_submission_days).toBe(1);
  });

  it("needs a whole number from 1 to 365", () => {
    for (const days of ["", "0", "366", "-5", "1.5", "60 days", "1e2"]) {
      expect(daysError(days)).toBe(DAYS_MESSAGE);
    }
  });
});

describe("settingsFormValues", () => {
  it("fills the form from the saved row", () => {
    expect(
      settingsFormValues({ allow_external_approval: true, late_submission_days: 60, updated_at: "2026-09-25T20:00:00Z" }),
    ).toEqual({ allow_external_approval: true, late_submission_days: "60" });
  });
});

describe("settingsSaveErrorMessage", () => {
  it("explains a denied save and hides other errors", () => {
    expect(settingsSaveErrorMessage({ code: "PGRST116" })).toBe("Only admins can change settings.");
    expect(settingsSaveErrorMessage({ code: "42501" })).toBe("Only admins can change settings.");
    expect(settingsSaveErrorMessage({ code: "23514" })).toBe(
      "Couldn't save the settings. Check your connection and try again.",
    );
  });
});
