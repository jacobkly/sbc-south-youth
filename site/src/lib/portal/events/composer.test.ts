import { describe, expect, it } from "vitest";
import { followStart } from "./composer";

const timed = { allDay: false, startDate: "2026-11-14", startTime: "19:00", endDate: "2026-11-14", endTime: "21:00" };

describe("followStart", () => {
  it("keeps the event as long as it was when the start moves", () => {
    expect(followStart(timed, { startDate: "2026-11-21", startTime: "19:00" })).toEqual({
      endDate: "2026-11-21",
      endTime: "21:00",
    });
    expect(followStart(timed, { startDate: "2026-11-14", startTime: "18:30" })).toEqual({
      endDate: "2026-11-14",
      endTime: "20:30",
    });
  });

  it("carries the end past midnight when it has to", () => {
    expect(followStart(timed, { startDate: "2026-11-14", startTime: "23:00" })).toEqual({
      endDate: "2026-11-15",
      endTime: "01:00",
    });
  });

  it("keeps an overnight event's length", () => {
    const retreat = { ...timed, startTime: "17:00", endDate: "2026-11-16", endTime: "12:00" };

    expect(followStart(retreat, { startDate: "2026-11-20", startTime: "17:00" })).toEqual({
      endDate: "2026-11-22",
      endTime: "12:00",
    });
  });

  it("ends two hours after the first start picked", () => {
    const blank = { ...timed, startTime: "", endDate: "", endTime: "" };

    expect(followStart(blank, { startDate: "2026-11-14", startTime: "19:00" })).toEqual({
      endDate: "2026-11-14",
      endTime: "21:00",
    });
  });

  it("keeps an end that was picked before the start time, when it still fits", () => {
    const endFirst = { ...timed, startTime: "", endDate: "", endTime: "22:00" };

    expect(followStart(endFirst, { startDate: "2026-11-14", startTime: "19:00" })).toEqual({
      endDate: "2026-11-14",
      endTime: "22:00",
    });
  });

  it("moves the end day along when only the start day is picked", () => {
    const blank = { ...timed, startDate: "", startTime: "", endDate: "", endTime: "" };

    expect(followStart(blank, { startDate: "2026-11-14", startTime: "" })).toEqual({
      endDate: "2026-11-14",
      endTime: "",
    });
    expect(followStart({ ...timed, startTime: "" }, { startDate: "2026-11-13", startTime: "" })).toEqual({
      endDate: "2026-11-14",
      endTime: "21:00",
    });
  });

  it("keeps an all-day event's number of days", () => {
    const allDay = { ...timed, allDay: true, startDate: "2026-11-06", endDate: "2026-11-08" };

    expect(followStart(allDay, { startDate: "2026-11-13", startTime: "19:00" })).toEqual({
      endDate: "2026-11-15",
      endTime: "21:00",
    });
  });

  it("leaves the end alone while the start isn't a real date", () => {
    expect(followStart(timed, { startDate: "", startTime: "19:00" })).toEqual({
      endDate: "2026-11-14",
      endTime: "21:00",
    });
  });
});
