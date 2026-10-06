import type { Metadata } from "next";
import { NarrowPage } from "@/components/nav/app-shell";
import { MyRequestForm } from "@/components/requests/my-request-form";
import { NotLinked } from "@/components/requests/not-linked";
import { getCurrentPayeeId } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";

export const metadata: Metadata = {
  title: "New request",
};

export default async function NewMyRequestPage() {
  const payeeId = await getCurrentPayeeId();
  if (!payeeId) return <NotLinked title="New request" />;

  return (
    <NarrowPage>
      <MyRequestForm payeeId={payeeId} today={todayInLA()} />
    </NarrowPage>
  );
}
