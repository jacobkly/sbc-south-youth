"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumnIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import { PayeeSheet } from "@/components/payees/payee-form";
import { Button } from "@/components/ui/button";

// Tiles with the icon on top on phones and tablets, plain buttons on PCs.
const ACTION = "h-auto min-h-16 flex-col gap-1.5 px-2 py-3 text-sm desktop:h-9 desktop:min-h-0 desktop:flex-row desktop:px-3 desktop:py-0";

/** Shortcuts for the most common jobs. Viewers only get reports. */
export function QuickActions({ canEdit }: { canEdit: boolean }) {
  const [addingPayee, setAddingPayee] = useState(false);

  return (
    <div className="grid grid-cols-3 gap-2 desktop:flex desktop:shrink-0">
      {canEdit && (
        <>
          <Button asChild className={ACTION}>
            <Link href="/admin/requests/new">
              <PlusIcon aria-hidden />
              New request
            </Link>
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
    </div>
  );
}
