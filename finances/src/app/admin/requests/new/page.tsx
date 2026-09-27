import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NarrowPage } from "@/components/nav/app-shell";
import { RequestForm } from "@/components/requests/request-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { PAYEE_COLUMNS } from "@/lib/payees/columns";
import { recentEventNames } from "@/lib/requests/event-names";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New request",
};

export default async function NewRequestPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/admin");

  const supabase = await createClient();
  const [payees, events, settings] = await Promise.all([
    supabase.from("payees").select(PAYEE_COLUMNS).eq("is_active", true).order("full_name"),
    supabase
      .from("reimbursement_requests")
      .select("event_name")
      .not("event_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("app_settings").select("allow_external_approval, late_submission_days").eq("id", 1).single(),
  ]);

  // Handled by admin/error.tsx.
  if (payees.error) throw payees.error;
  if (events.error) throw events.error;
  if (settings.error) throw settings.error;

  return (
    <NarrowPage>
      <RequestForm
        payees={payees.data}
        eventNames={recentEventNames(events.data)}
        today={todayInLA()}
        currentUserId={user.id}
        allowExternalApproval={settings.data.allow_external_approval}
        lateLimitDays={settings.data.late_submission_days}
      />
    </NarrowPage>
  );
}
