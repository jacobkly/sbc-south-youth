import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportFlow } from "@/components/import/import-flow";
import { NarrowPage } from "@/components/nav/app-shell";
import { BackLink } from "@/components/nav/back-link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import from a spreadsheet",
};

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/admin/settings");

  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("app_settings")
    .select("allow_external_approval")
    .eq("id", 1)
    .single();

  // Handled by admin/error.tsx.
  if (error) throw error;

  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-2">
        <BackLink fallbackHref="/admin/settings" fallbackLabel="Settings" />
        <h1 className="text-2xl font-semibold tracking-tight">Import from a spreadsheet</h1>
      </div>
      <ImportFlow currentUserId={user.id} allowExternalApproval={settings.allow_external_approval} />
    </NarrowPage>
  );
}
