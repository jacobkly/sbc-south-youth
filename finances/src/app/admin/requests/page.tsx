import type { Metadata } from "next";
import { RequestQueue } from "@/components/requests/request-queue";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadQueue } from "@/lib/requests/queries";
import { parseQueueFilters } from "@/lib/requests/queue";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Requests",
};

export default async function RequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  const filters = parseQueueFilters(await searchParams);
  const supabase = await createClient();
  const [user, payees] = await Promise.all([
    getCurrentUser(),
    supabase.from("payees").select("id, full_name, is_active").order("full_name"),
  ]);
  if (payees.error) throw payees.error; // handled by admin/error.tsx

  // Payee names are matched here, since one PostgREST `or` can't span a request and its payee.
  const needle = filters.q.toLowerCase();
  const matchingPayees = needle
    ? payees.data.filter((payee) => payee.full_name.toLowerCase().includes(needle)).map((payee) => payee.id)
    : [];
  const { tab, ...queue } = await loadQueue(supabase, filters, matchingPayees);

  return (
    <RequestQueue
      filters={{ ...filters, tab }}
      {...queue}
      payees={payees.data}
      canCreate={user?.role === "admin"}
    />
  );
}
