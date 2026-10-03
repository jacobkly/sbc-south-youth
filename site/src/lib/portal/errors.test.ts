import { describe, expect, it } from "vitest";
import { actionError } from "./errors";

describe("actionError", () => {
  const fallback = "Couldn't save the photo. Check your connection and try again.";

  function recorder() {
    const reports: { source: string; error: unknown }[] = [];
    return { reports, report: async (source: string, error: unknown) => void reports.push({ source, error }) };
  }

  it("shows a refused change's own message and doesn't log it, since nothing broke", async () => {
    const { reports, report } = recorder();
    const error = { code: "22023", message: "Give the photo a description first." };

    expect(await actionError("Save a photo", error, fallback, report)).toBe("Give the photo a description first.");
    expect(reports).toEqual([]);
  });

  it("logs an unexpected failure and shows the fallback", async () => {
    const { reports, report } = recorder();
    const error = { code: "42501", message: 'new row violates row-level security policy for table "photos"' };

    expect(await actionError("Save a photo", error, fallback, report)).toBe(fallback);
    expect(reports).toEqual([{ source: "Save a photo", error }]);
  });

  it("logs a failure with no code, like a dropped connection", async () => {
    const { reports, report } = recorder();
    const error = { message: "TypeError: fetch failed" };

    expect(await actionError("Save a photo", error, fallback, report)).toBe(fallback);
    expect(reports).toEqual([{ source: "Save a photo", error }]);
  });

  it("logs nothing when there's no error to log", async () => {
    const { reports, report } = recorder();

    expect(await actionError("Save a photo", null, fallback, report)).toBe(fallback);
    expect(reports).toEqual([]);
  });
});
