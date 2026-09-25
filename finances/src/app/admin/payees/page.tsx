import type { Metadata } from "next";
import { PayeeList } from "@/components/payees/payee-list";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PAYEE_COLUMNS } from "@/lib/payees/columns";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payees",
};

export default async function PayeesPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: payees, error } = await supabase
    .from("payees")
    .select(PAYEE_COLUMNS)
    .order("full_name");

  if (error) throw error; // handled by admin/error.tsx
  return <PayeeList payees={payees} canEdit={user?.role === "admin"} />;
}
