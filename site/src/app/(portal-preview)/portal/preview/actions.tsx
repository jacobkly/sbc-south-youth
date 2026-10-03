"use server";

import type { ReactNode } from "react";
import { AgendaDay } from "@/components/site/agenda-day";
import { AnnouncementCard } from "@/components/site/announcement-card";
import { EventPageBody } from "@/components/site/event-page";
import { Spotlight } from "@/components/site/spotlight";
import { seedEventPhotos } from "@/content/events";
import { formatAddress } from "@/content/site";
import { getEvents } from "@/lib/content/loaders";
import { todayInLA } from "@/lib/dates";
import { oneOffEventView } from "@/lib/event-view";
import { eventItem } from "@/lib/feed";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { previewEvent, previewPost, readPreviewRequest, type PreviewResult } from "@/lib/portal/preview/preview";
import { hasRole } from "@/lib/portal/roles";
import { createClient } from "@/lib/supabase/server";

/**
 * Renders a draft with the public site's own components, for the editors'
 * Preview tab. It only reads, so it works on staging too. It never
 * redirects, since it answers a frame: a lapsed sign-in comes back as a
 * problem to show instead. It sits beside the preview page, where the
 * public stylesheet looks for classes, since it lays out site markup.
 */

const SIGNED_OUT = "Your sign-in ran out. Reload the page and sign in again to see the preview.";
const REFUSAL = "Only site editors can preview heads-ups and events.";

export async function renderPreview(raw: unknown): Promise<PreviewResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return { problem: SIGNED_OUT };
  const me = await getCurrentUser();
  if (!me?.is_active || !hasRole(me.roles, "site_editor")) return { problem: REFUSAL };

  const request = readPreviewRequest(raw);
  if (!request) return { problem: "Something here can't be shown yet." };

  if (request.kind === "post") {
    const preview = previewPost(request.values, await getEvents());
    if (!preview.ok) return { problem: preview.problem };
    return {
      node: (
        <>
          <Section title="On This Week" note="While it's up.">
            <div className="max-w-[22rem]">
              <AnnouncementCard post={preview.post} eager />
            </div>
          </Section>
          <Section title="On Home" note="The newest pinned heads-up leads Home, or the newest one if none is pinned.">
            <div className="h-[30rem] max-w-3xl">
              <Spotlight post={preview.post} />
            </div>
          </Section>
        </>
      ),
    };
  }

  const { id, slug, values } = request;
  const photo = id && Object.hasOwn(seedEventPhotos, id) ? seedEventPhotos[id] : undefined;
  const preview = previewEvent(values, { id, slug, photo });
  if (!preview.ok) return { problem: preview.problem };

  const now = new Date();
  const item = eventItem(preview.event);
  return {
    node: (
      <>
        <Section title="On This Week" note="From 8 weeks before it starts until it ends.">
          <ol className="max-w-3xl">
            <AgendaDay day={{ date: item.date, items: [item] }} today={todayInLA(now)} />
          </ol>
        </Section>
        <Section title="Its page" bleed>
          <EventPageBody view={oneOffEventView(preview.event, now, formatAddress())} />
        </Section>
      </>
    ),
  };
}

/** Where on the site this part shows. A `bleed` part sets its own margins, like a page does. */
function Section({
  title,
  note,
  bleed = false,
  children,
}: {
  title: string;
  note?: string;
  bleed?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line py-8 last:border-b-0">
      <header className="page-x mb-5">
        <h2 className="text-eyebrow text-accent-ink uppercase">{title}</h2>
        {note && <p className="mt-1 text-small text-muted">{note}</p>}
      </header>
      {bleed ? children : <div className="page-x">{children}</div>}
    </section>
  );
}
