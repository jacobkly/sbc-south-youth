import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NarrowPage } from "@/components/nav/app-shell";
import { BackLink } from "@/components/nav/back-link";
import { TagManager } from "@/components/tags/tag-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { sortTags, TAG_COLUMNS } from "@/lib/tags/tags";
import { loadTagStats } from "@/lib/tags/totals";

export const metadata: Metadata = {
  title: "Tags",
};

export default async function TagsPage() {
  const user = await getCurrentUser();
  // Owners and finance viewers read tags. Requesters never see them.
  if (!user || user.role === "member") redirect("/admin/settings");

  const supabase = await createClient();
  const [{ data: tags, error }, stats] = await Promise.all([
    supabase.from("tags").select(TAG_COLUMNS),
    loadTagStats(supabase, user.id),
  ]);

  // Handled by admin/error.tsx.
  if (error) throw error;

  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-2">
        <BackLink fallbackHref="/admin/settings" fallbackLabel="Settings" />
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Each tag&apos;s requests over all time. Totals count approved and paid requests, like reports do.
        </p>
      </div>
      <TagManager tags={sortTags(tags)} stats={stats} canEdit={user.role === "admin"} />
    </NarrowPage>
  );
}
