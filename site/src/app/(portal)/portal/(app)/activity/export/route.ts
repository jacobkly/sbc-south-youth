import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { todayInLA } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { activityCsv } from "@/lib/portal/activity/feed";
import { activityQuery, parseActivityFilters, scopesFor } from "@/lib/portal/activity/filters";
import {
  loadActivityForExport,
  loadFeedLookups,
  loadPeopleNames,
  recordActivityExport,
} from "@/lib/portal/activity/queries";
import { getCurrentUser, getSessionAal } from "@/lib/portal/auth/current-user";
import { mfaHref, ownerNeedsMfa } from "@/lib/portal/auth/mfa";
import { reportPortalError } from "@/lib/portal/errors";
import { canUsePortal, hasRole } from "@/lib/portal/roles";

/** The most events one download holds. */
const MAX_EXPORT_ROWS = 10_000;

/**
 * The Activity feed as a CSV file, for owners. It downloads what the
 * screen's filters show, every page of it. Each download is itself logged
 * first, and nothing goes out if that fails.
 */
export async function GET(request: NextRequest) {
  // Route handlers skip the shell, so this makes the shell's checks itself.
  const me = await getCurrentUser();
  if (!me || !canUsePortal(me) || !hasRole(me.roles, "owner")) {
    return new Response("Only owners can download activity.", { status: 403 });
  }
  if (ownerNeedsMfa(me.roles, await getSessionAal())) redirect(mfaHref("/activity"));

  const visible = scopesFor(me.roles);
  const filters = parseActivityFilters(Object.fromEntries(request.nextUrl.searchParams), visible);
  const filename = `activity-${todayInLA()}.csv`;

  try {
    await recordActivityExport(filename);
  } catch (error) {
    await reportPortalError("Download activity", error);
    return new Response("Couldn't start the download. Try again in a minute.", { status: 500 });
  }

  const { rows } = await loadActivityForExport(activityQuery(filters, visible), MAX_EXPORT_ROWS);
  const [names, lookups] = await Promise.all([loadPeopleNames(), loadFeedLookups(rows)]);
  const csv = activityCsv(rows, {
    meId: me.id,
    names,
    ...lookups,
    financesUrl: readPortalEnv().financesUrl,
    canOpenPeople: true,
    today: todayInLA(),
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
