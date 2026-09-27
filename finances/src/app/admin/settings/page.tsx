import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheetIcon } from "lucide-react";
import { NarrowPage } from "@/components/nav/app-shell";
import { SettingsForm, SettingsSummary } from "@/components/settings/settings-form";
import { ThemePicker } from "@/components/settings/theme-picker";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SETTINGS_COLUMNS } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const [user, { data: settings, error }] = await Promise.all([
    getCurrentUser(),
    supabase.from("app_settings").select(SETTINGS_COLUMNS).eq("id", 1).single(),
  ]);

  // Handled by admin/error.tsx.
  if (error) throw error;

  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {/* Viewers can read the settings. The update policy lets only admins change them. */}
      {user?.role === "admin" ? <SettingsForm settings={settings} /> : <SettingsSummary settings={settings} />}

      <ThemePicker userId={user?.id ?? null} className="border-t pt-6" />

      {user?.role === "admin" && (
        <section aria-labelledby="settings-import-heading" className="space-y-3 border-t pt-6">
          <h2 id="settings-import-heading" className="text-lg font-semibold">
            Import
          </h2>
          <p className="text-sm text-muted-foreground">
            Bring in reimbursements that were already paid, from a spreadsheet with Date, Name, Amount, Type, and Notes
            columns.
          </p>
          <Button variant="outline" className="h-11 px-5" asChild>
            <Link href="/admin/settings/import">
              <FileSpreadsheetIcon aria-hidden />
              Import from a spreadsheet
            </Link>
          </Button>
        </section>
      )}
    </NarrowPage>
  );
}
