"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumnIcon, CoffeeIcon, HandCoinsIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import { CafeWeekSheet } from "@/components/income/cafe-week-sheet";
import { YouthIncomeSheet } from "@/components/income/youth-income-sheet";
import { PayeeSheet } from "@/components/payees/payee-form";
import { Button } from "@/components/ui/button";
import type { IsoDate } from "@/lib/dates";
import type { CafeWeek } from "@/lib/income/cafe";
import { defaultWeekEnding } from "@/lib/income/weeks";
import { cn } from "@/lib/utils";

// Tiles with the icon on top on phones and tablets, plain buttons on PCs.
const ACTION = "h-auto min-h-16 flex-col gap-1.5 px-2 py-3 text-sm desktop:h-9 desktop:min-h-0 desktop:flex-row desktop:px-3 desktop:py-0";

/** Shortcuts for the most common jobs. Viewers only get reports. */
export function QuickActions({
  canEdit,
  today,
  cafeWeeks,
}: {
  canEdit: boolean;
  today: IsoDate;
  /** The cafe weeks already in, for the cafe sheet. Empty for viewers. */
  cafeWeeks: CafeWeek[];
}) {
  const [addingPayee, setAddingPayee] = useState(false);
  const [addingTithe, setAddingTithe] = useState(false);
  const [cafeWeek, setCafeWeek] = useState<IsoDate | null>(null);

  return (
    <div className={cn("grid gap-2 desktop:flex desktop:shrink-0", canEdit ? "grid-cols-2" : "grid-cols-3")}>
      {canEdit && (
        <>
          {/* Five tiles don't pair up on a phone, so the main one takes a whole row. */}
          <Button asChild className={cn(ACTION, "col-span-2")}>
            <Link href="/admin/requests/new">
              <PlusIcon aria-hidden />
              New request
            </Link>
          </Button>
          <Button variant="outline" className={ACTION} onClick={() => setAddingTithe(true)}>
            <HandCoinsIcon aria-hidden />
            Add tithe
          </Button>
          <Button variant="outline" className={ACTION} onClick={() => setCafeWeek(defaultWeekEnding(today))}>
            <CoffeeIcon aria-hidden />
            Add cafe week
          </Button>
          <Button variant="outline" className={ACTION} onClick={() => setAddingPayee(true)}>
            <UserPlusIcon aria-hidden />
            Add payee
          </Button>
        </>
      )}
      <Button variant="outline" asChild className={ACTION}>
        <Link href="/admin/reports">
          <ChartColumnIcon aria-hidden />
          Reports
        </Link>
      </Button>
      {canEdit && <PayeeSheet payee={addingPayee ? "new" : null} onClose={() => setAddingPayee(false)} />}
      {canEdit && <YouthIncomeSheet entry={addingTithe ? "new" : null} onClose={() => setAddingTithe(false)} />}
      {canEdit && (
        <CafeWeekSheet weekEnding={cafeWeek} weeks={cafeWeeks} today={today} onClose={() => setCafeWeek(null)} />
      )}
    </div>
  );
}
