import type { Metadata } from "next";
import { NarrowPage } from "@/components/nav/app-shell";
import { MyRequestForm } from "@/components/requests/my-request-form";
import { NotLinked } from "@/components/requests/not-linked";
import { getCurrentPayeeId } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { recentEventNames } from "@/lib/requests/event-names";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New request",
};

export default async function NewMyRequestPage() {
  const payeeId = await getCurrentPayeeId();
  if (!payeeId) return <NotLinked title="New request" />;

  const supabase = await createClient();
  // Suggests events from their own requests.
  const events = await supabase
    .from("reimbursement_requests")
    .select("event_name")
    .eq("payee_id", payeeId)
    .not("event_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  // Handled by my/error.tsx.
  if (events.error) throw events.error;

  return (
    <NarrowPage>
      <MyRequestForm payeeId={payeeId} eventNames={recentEventNames(events.data)} today={todayInLA()} />
    </NarrowPage>
  );
}
