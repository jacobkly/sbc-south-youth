import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { ActivityView, type ActivityPerson } from "@/components/portal/activity/activity-view";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Button } from "@/components/portal/ui/button";
import { todayInLA } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { buildActivityDays } from "@/lib/portal/activity/feed";
import { activityHref, activityQuery, parseActivityFilters, scopesFor } from "@/lib/portal/activity/filters";
import { loadActivity, loadFeedLookups, loadPeopleNames } from "@/lib/portal/activity/queries";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { canUseFinances, hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "Activity",
};

export default async function ActivityPage({ searchParams }: PageProps<"/portal/activity">) {
  // Each role sees its own app's history, and RLS holds back the rest anyway.
  const me = await getCurrentUser();
  const visible = me ? scopesFor(me.roles) : [];
  if (!me || visible.length === 0) notFound();

  const filters = parseActivityFilters(await searchParams, visible);
  // Each throws on failure, and the error page handles it.
  const [{ rows, hasMore, capped }, names] = await Promise.all([
    loadActivity(activityQuery(filters, visible), filters.pages),
    loadPeopleNames(),
  ]);
  const lookups = await loadFeedLookups(rows);
  const owner = hasRole(me.roles, "owner");
  const days = buildActivityDays(rows, {
    meId: me.id,
    names,
    ...lookups,
    financesUrl: canUseFinances(me.roles) ? readPortalEnv().financesUrl : null,
    canOpenPeople: owner,
    today: todayInLA(),
  });

  const others = [...names].filter(([id]) => id !== me.id).sort(([, a], [, b]) => a.localeCompare(b));
  const people: ActivityPerson[] = [
    { id: me.id, label: "You" },
    ...others.map(([id, name]) => ({ id, label: name })),
  ];

  return (
    <NarrowPage className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        {owner && (
          <Button asChild variant="outline" className="h-11 px-4">
            {/* A plain link, so the browser downloads the file instead of the router fetching it. */}
            <a href={activityHref(filters, "/activity/export")} download>
              <DownloadIcon aria-hidden />
              Download
              <span className="sr-only"> as a spreadsheet</span>
            </a>
          </Button>
        )}
      </header>

      <ActivityView
        filters={filters}
        visible={visible}
        people={people}
        days={days}
        hasMore={hasMore}
        capped={capped}
      />
    </NarrowPage>
  );
}
