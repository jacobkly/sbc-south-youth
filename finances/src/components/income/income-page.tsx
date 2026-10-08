"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { CafeMonthSummary, CafeWeekList } from "@/components/income/cafe-income";
import { CafeWeekSheet } from "@/components/income/cafe-week-sheet";
import { YouthIncomeSheet } from "@/components/income/youth-income-sheet";
import { YouthEntryList, YouthMonthSummary } from "@/components/income/youth-income";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IsoDate, MonthPeriod } from "@/lib/dates";
import type { CafeCost, CafeTotals, CafeWeek } from "@/lib/income/cafe";
import { incomeHref, type IncomeTab } from "@/lib/income/view";
import type { YouthEntry, YouthSummary } from "@/lib/income/stats";
import { defaultWeekEnding } from "@/lib/income/weeks";

/**
 * Money coming in, in two tabs that match the request types. The tab lives in
 * the URL, so coming back to the page keeps it.
 */
export function IncomePage({
  tab,
  canEdit,
  today,
  month,
  youthEntries,
  youthMonth,
  cafeWeeks,
  cafeCosts,
  cafeMonth,
}: {
  tab: IncomeTab;
  canEdit: boolean;
  today: IsoDate;
  /** The month the summaries cover: this one. */
  month: MonthPeriod;
  youthEntries: YouthEntry[];
  youthMonth: YouthSummary;
  /** Newest first. */
  cafeWeeks: CafeWeek[];
  /** The cafe requests that count against sales, back to the oldest week's month. */
  cafeCosts: CafeCost[];
  cafeMonth: CafeTotals;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(tab);
  const [youthEntry, setYouthEntry] = useState<YouthEntry | "new" | null>(null);
  const [cafeWeek, setCafeWeek] = useState<IsoDate | null>(null);
  const addCafeWeek = () => setCafeWeek(defaultWeekEnding(today));

  function showTab(next: IncomeTab) {
    startTransition(() => {
      setShown(next);
      router.replace(incomeHref(next), { scroll: false });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
        {canEdit && (
          <Button className="h-10 px-4" onClick={shown === "youth" ? () => setYouthEntry("new") : addCafeWeek}>
            <PlusIcon />
            Add<span className="sr-only">{shown === "youth" ? " youth income" : " cafe week"}</span>
          </Button>
        )}
      </div>

      <Tabs value={shown} onValueChange={(value) => showTab(value as IncomeTab)}>
        <TabsList className="w-full group-data-horizontal/tabs:h-10 @4xl/main:w-72 @4xl/main:group-data-horizontal/tabs:h-11">
          <TabsTrigger value="youth">Youth</TabsTrigger>
          <TabsTrigger value="cafe">Cafe</TabsTrigger>
        </TabsList>
        <TabsContent value="youth" className="mt-2 space-y-6">
          <YouthMonthSummary month={month} summary={youthMonth} />
          <YouthEntryList
            entries={youthEntries}
            today={today}
            onOpen={canEdit ? setYouthEntry : undefined}
            onAdd={canEdit ? () => setYouthEntry("new") : undefined}
          />
        </TabsContent>
        <TabsContent value="cafe" className="mt-2 space-y-6">
          <CafeMonthSummary month={month} totals={cafeMonth} />
          <CafeWeekList
            weeks={cafeWeeks}
            costs={cafeCosts}
            today={today}
            onOpen={canEdit ? (week) => setCafeWeek(week.week_ending) : undefined}
            onAdd={canEdit ? addCafeWeek : undefined}
          />
        </TabsContent>
      </Tabs>

      {canEdit && <YouthIncomeSheet entry={youthEntry} onClose={() => setYouthEntry(null)} />}
      {canEdit && (
        <CafeWeekSheet weekEnding={cafeWeek} weeks={cafeWeeks} today={today} onClose={() => setCafeWeek(null)} />
      )}
    </div>
  );
}
