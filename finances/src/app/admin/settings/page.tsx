import type { Metadata } from "next";
import { SettingsForm, SettingsSummary } from "@/components/settings/settings-form";
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {/* Viewers can read the settings. The update policy lets only admins change them. */}
      {user?.role === "admin" ? <SettingsForm settings={settings} /> : <SettingsSummary settings={settings} />}
    </div>
  );
}
