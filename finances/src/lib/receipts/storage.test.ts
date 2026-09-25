import { describe, expect, it } from "vitest";
import { formatStorage, storageUsage } from "./storage";

describe("storageUsage", () => {
  it("is ok below 70%", () => {
    expect(storageUsage(0)).toEqual({ percent: 0, level: "ok" });
    expect(storageUsage(699_999_999)).toEqual({ percent: 69, level: "ok" });
  });

  it("warns from 70% and turns critical from 90%", () => {
    expect(storageUsage(700_000_000)).toEqual({ percent: 70, level: "warning" });
    expect(storageUsage(899_999_999)).toEqual({ percent: 89, level: "warning" });
    expect(storageUsage(900_000_000)).toEqual({ percent: 90, level: "critical" });
  });

  it("keeps counting past the limit", () => {
    expect(storageUsage(1_050_000_000)).toEqual({ percent: 105, level: "critical" });
  });
});

describe("formatStorage", () => {
  it("uses KB, MB, or GB", () => {
    expect(formatStorage(0)).toBe("0 KB");
    expect(formatStorage(512_000)).toBe("512 KB");
    expect(formatStorage(123_456_789)).toBe("123.5 MB");
    expect(formatStorage(1_050_000_000)).toBe("1.05 GB");
  });
});
