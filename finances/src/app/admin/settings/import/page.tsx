import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { ImportFlow } from "@/components/import/import-flow";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
          <Link href="/admin/settings">
            <ChevronLeftIcon aria-hidden />
            Settings
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Import from a spreadsheet</h1>
      </div>
      <ImportFlow currentUserId={user.id} allowExternalApproval={settings.allow_external_approval} />
    </div>
  );
}
