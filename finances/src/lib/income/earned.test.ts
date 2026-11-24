import { describe, expect, it } from "vitest";
import { NO_LINES, type CafeLines } from "./cafe";
import { earnedIncome, incomeIn } from "./earned";

function week(week_ending: string, sales_cents: number, lines: Partial<CafeLines> = {}) {
  return { week_ending, ...NO_LINES, sales_cents, ...lines };
}

const youth = [
  { received_on: "2026-09-06", amount_cents: 2000 },
  { received_on: "2026-10-04", amount_cents: 4000 },
];
const weeks = [
  week("2026-09-06", 30000, { discounts_cents: 2000, fees_cents: 1000 }),
  week("2026-10-04", 25000),
];
const paybacks = [
  { kind: "discounts" as const, received_on: "2026-09-10", amount_cents: 9999 },
  { kind: "gift_cards" as const, received_on: "2026-09-12", amount_cents: 25000 },
  { kind: "gift_cards" as const, received_on: "2026-10-12", amount_cents: 500 },
];

describe("earnedIncome", () => {
  it("adds youth income, the cafe's money from Square, its discounts, and the church's gift card money", () => {
    expect(earnedIncome({ youth, weeks, paybacks })).toEqual({
      youth: 6000,
      square: 52000,
      discounts: 2000,
      giftCards: 25500,
      cafe: 79500,
      total: 85500,
    });
  });

  it("leaves out discount paybacks, since the discounts already count", () => {
    expect(earnedIncome({ youth: [], weeks: [], paybacks: [paybacks[0]] }).total).toBe(0);
  });
});

describe("incomeIn", () => {
  it("keeps what came in on a day in the range, and cafe weeks that end in it", () => {
    const september = { start: "2026-09-06", end: "2026-09-30" };
    expect(incomeIn({ youth, weeks, paybacks }, september)).toEqual({
      youth: [youth[0]],
      weeks: [weeks[0]],
      paybacks: [paybacks[0], paybacks[1]],
    });
  });
});
