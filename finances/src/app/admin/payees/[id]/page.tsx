import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditPayeeButton } from "@/components/payees/edit-payee-button";
import { PayeeDetail } from "@/components/payees/payee-detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { PAYEE_COLUMNS } from "@/lib/payees/columns";
import { loadPayeeTotals } from "@/lib/payees/totals";
import { loadPayeeRequests } from "@/lib/requests/queries";
import { DEFAULT_QUEUE_FILTERS, queueHref } from "@/lib/requests/queue";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payee",
};

const RECENT_REQUESTS = 10;

export default async function PayeePage({ params }: PageProps<"/admin/payees/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const year = Number(todayInLA().slice(0, 4));
  const supabase = await createClient();
  // The loaders throw on failure, and admin/error.tsx handles it.
  const [{ data: payee, error }, totals, requests, user] = await Promise.all([
    supabase.from("payees").select(PAYEE_COLUMNS).eq("id", id).maybeSingle(),
    loadPayeeTotals(supabase, id, year),
    loadPayeeRequests(supabase, id, RECENT_REQUESTS),
    getCurrentUser(),
  ]);

  if (error) throw error;
  if (!payee) notFound();

  return (
    <PayeeDetail
      payee={payee}
      totals={totals}
      year={year}
      requests={requests.rows}
      totalRequests={requests.total}
      allRequestsHref={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "all", payee: id })}
      actions={user?.role === "admin" && <EditPayeeButton payee={payee} />}
    />
  );
}
