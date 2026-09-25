import type { Metadata } from "next";
import { PayeeList } from "@/components/payees/payee-list";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { PAYEE_COLUMNS } from "@/lib/payees/columns";
import { loadYearTotals } from "@/lib/payees/totals";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payees",
};

export default async function PayeesPage() {
  const year = Number(todayInLA().slice(0, 4));
  const supabase = await createClient();
  // loadYearTotals throws on failure, and admin/error.tsx handles it.
  const [user, { data: payees, error }, yearTotals] = await Promise.all([
    getCurrentUser(),
    supabase.from("payees").select(PAYEE_COLUMNS).order("full_name"),
    loadYearTotals(supabase, year),
  ]);

  if (error) throw error;
  return <PayeeList payees={payees} canEdit={user?.role === "admin"} yearTotals={yearTotals} year={year} />;
}
