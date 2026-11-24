import type { DateRange, IsoDate } from "@/lib/dates";
import { moneyFromSquare, type CafePaybackIncome, type CafeSales } from "./cafe";
import type { YouthEntry } from "./stats";

/** What totals need from a youth entry. */
export type YouthIncome = Pick<YouthEntry, "received_on" | "amount_cents">;

export type IncomeSources = {
  youth: readonly YouthIncome[];
  weeks: readonly CafeSales[];
  paybacks: readonly CafePaybackIncome[];
};

export type EarnedIncome = {
  /** Tithes and events. */
  youth: number;
  /** The cafe's money from Square. */
  square: number;
  /** The cafe's discounts, which the church pays back. */
  discounts: number;
  /** What the church prepaid for the cafe's gift cards. */
  giftCards: number;
  /** Always `square + discounts + giftCards`. */
  cafe: number;
  /** Always `cafe + youth`. */
  total: number;
};

/** The income dated in a range. A cafe week is dated the Sunday it ends. */
export function incomeIn({ youth, weeks, paybacks }: IncomeSources, { start, end }: DateRange): IncomeSources {
  const inRange = (date: IsoDate) => date >= start && date <= end;
  return {
    youth: youth.filter((entry) => inRange(entry.received_on)),
    weeks: weeks.filter((week) => inRange(week.week_ending)),
    paybacks: paybacks.filter((payback) => inRange(payback.received_on)),
  };
}

/**
 * Income as profit counts it: the cafe's discounts in the week they were
 * given, and the church's gift card money when it came in. Discount paybacks
 * don't count, since the discounts already do.
 */
export function earnedIncome({ youth, weeks, paybacks }: IncomeSources): EarnedIncome {
  const youthCents = youth.reduce((total, entry) => total + entry.amount_cents, 0);
  const square = weeks.reduce((total, week) => total + moneyFromSquare(week), 0);
  const discounts = weeks.reduce((total, week) => total + week.discounts_cents, 0);
  const giftCards = paybacks.reduce(
    (total, payback) => (payback.kind === "gift_cards" ? total + payback.amount_cents : total),
    0,
  );
  const cafe = square + discounts + giftCards;
  return { youth: youthCents, square, discounts, giftCards, cafe, total: cafe + youthCents };
}
