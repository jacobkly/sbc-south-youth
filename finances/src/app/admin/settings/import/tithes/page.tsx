import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TitheImport } from "@/components/import/tithe-import";
import { NarrowPage } from "@/components/nav/app-shell";
import { BackLink } from "@/components/nav/back-link";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Import tithes",
};

export default async function TitheImportPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/admin/settings");

  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-2">
        <BackLink fallbackHref="/admin/settings" fallbackLabel="Settings" />
        <h1 className="text-2xl font-semibold tracking-tight">Import tithes</h1>
      </div>
      <TitheImport />
    </NarrowPage>
  );
}
