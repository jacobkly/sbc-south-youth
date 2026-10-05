"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { YouthIncomeSheet } from "@/components/income/youth-income-sheet";
import { YouthEntryList, YouthMonthSummary } from "@/components/income/youth-income";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IsoDate, MonthPeriod } from "@/lib/dates";
import { incomeHref, type IncomeTab } from "@/lib/income/view";
import type { YouthEntry, YouthSummary } from "@/lib/income/stats";

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
}: {
  tab: IncomeTab;
  canEdit: boolean;
  today: IsoDate;
  /** The month the summary covers: this one. */
  month: MonthPeriod;
  youthEntries: YouthEntry[];
  youthMonth: YouthSummary;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(tab);
  const [youthEntry, setYouthEntry] = useState<YouthEntry | "new" | null>(null);

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
        {canEdit && shown === "youth" && (
          <Button className="h-10 px-4" onClick={() => setYouthEntry("new")}>
            <PlusIcon />
            Add<span className="sr-only"> youth income</span>
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
        <TabsContent value="cafe" className="mt-2">
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            <p>Cafe weeks are coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>

      {canEdit && <YouthIncomeSheet entry={youthEntry} onClose={() => setYouthEntry(null)} />}
    </div>
  );
}
