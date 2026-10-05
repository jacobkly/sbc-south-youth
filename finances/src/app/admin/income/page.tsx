import type { Metadata } from "next";
import { IncomePage } from "@/components/income/income-page";
import { getCurrentUser } from "@/lib/auth/current-user";
import { periodContaining, periodRange, todayInLA, type MonthPeriod } from "@/lib/dates";
import { cafeMonthTotals } from "@/lib/income/cafe";
import { loadCafeCosts, loadCafeWeeks, loadYouthEntries } from "@/lib/income/queries";
import { youthSummary } from "@/lib/income/stats";
import { parseIncomeTab } from "@/lib/income/view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Income",
};

export default async function IncomeRoute({ searchParams }: PageProps<"/admin/income">) {
  const today = todayInLA();
  const month = periodContaining("month", today) as MonthPeriod;
  const { start, end } = periodRange(month);
  const supabase = await createClient();
  // The loaders throw on failure, and admin/error.tsx handles it.
  const [user, youthEntries, cafe] = await Promise.all([
    getCurrentUser(),
    loadYouthEntries(supabase),
    loadCafeWeeks(supabase).then(async (weeks) => {
      // Costs only matter back to the oldest week's month, or this month for the summary.
      const oldest = weeks.at(-1)?.week_ending;
      const from = oldest && oldest < start ? `${oldest.slice(0, 7)}-01` : start;
      return { weeks, costs: await loadCafeCosts(supabase, from) };
    }),
  ]);

  return (
    <IncomePage
      tab={parseIncomeTab(await searchParams)}
      canEdit={user?.role === "admin"}
      today={today}
      month={month}
      youthEntries={youthEntries}
      youthMonth={youthSummary(youthEntries.filter((entry) => entry.received_on >= start && entry.received_on <= end))}
      cafeWeeks={cafe.weeks}
      cafeCosts={cafe.costs}
      cafeMonth={cafeMonthTotals(cafe.weeks, cafe.costs, month)}
    />
  );
}
