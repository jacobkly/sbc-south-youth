import type { Metadata } from "next";
import { IncomePage } from "@/components/income/income-page";
import { getCurrentUser } from "@/lib/auth/current-user";
import { periodContaining, periodRange, todayInLA, type MonthPeriod } from "@/lib/dates";
import { loadYouthEntries } from "@/lib/income/queries";
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
  // loadYouthEntries throws on failure, and admin/error.tsx handles it.
  const [user, youthEntries] = await Promise.all([getCurrentUser(), loadYouthEntries(supabase)]);

  return (
    <IncomePage
      tab={parseIncomeTab(await searchParams)}
      canEdit={user?.role === "admin"}
      today={today}
      month={month}
      youthEntries={youthEntries}
      youthMonth={youthSummary(youthEntries.filter((entry) => entry.received_on >= start && entry.received_on <= end))}
    />
  );
}
