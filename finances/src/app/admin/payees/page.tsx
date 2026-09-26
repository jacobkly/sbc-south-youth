import type { Metadata } from "next";
import { PayeeList } from "@/components/payees/payee-list";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { PAYEE_LIST_COLUMNS } from "@/lib/payees/columns";
import { parsePayeeSort } from "@/lib/payees/sort";
import { loadYearTotals } from "@/lib/payees/totals";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payees",
};

export default async function PayeesPage({ searchParams }: PageProps<"/admin/payees">) {
  const year = Number(todayInLA().slice(0, 4));
  const supabase = await createClient();
  // loadYearTotals throws on failure, and admin/error.tsx handles it.
  const [user, { data: payees, error }, yearTotals] = await Promise.all([
    getCurrentUser(),
    supabase.from("payees").select(PAYEE_LIST_COLUMNS),
    loadYearTotals(supabase, year),
  ]);

  if (error) throw error;
  return (
    <PayeeList
      payees={payees}
      sort={parsePayeeSort(await searchParams)}
      canEdit={user?.role === "admin"}
      yearTotals={yearTotals}
      year={year}
    />
  );
}
