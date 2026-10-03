import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InlineScript } from "@/components/inline-script";
import { EventPageBody } from "@/components/site/event-page";
import { FeedGuard } from "@/components/site/feed-guard";
import { FirstTimeBand } from "@/components/site/first-time-band";
import { getEventSlugs } from "@/lib/content/loaders";
import { eventDescription, eventView } from "@/lib/event-view";
import { FEED_ID, inlineCall, refreshFeed } from "@/lib/feed-dom";
import { jsonLdScript } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/metadata";

export async function generateStaticParams() {
  return (await getEventSlugs()).map((slug) => ({ slug }));
}

/**
 * Events known when the site builds are prerendered. Any other slug, like
 * one added since, renders on its first visit, or 404s if there's no such
 * event. Letting it block, instead of streaming a loading shell, means a
 * missing one gets a real 404 status.
 */
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const view = await eventView(slug);
  // The page itself calls notFound(). This only names the tab.
  if (!view) return { title: "Page not found" };
  return pageMetadata({
    title: view.title,
    description: eventDescription(view),
    path: `/events/${slug}`,
  });
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const view = await eventView(slug);
  if (!view) notFound();

  return (
    <div id={FEED_ID} className="pb-16 lg:pb-24">
      {view.jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(view.jsonLd) }} />}
      <EventPageBody view={view} />

      <div className="page-x mt-12 lg:mt-16">
        <FirstTimeBand />
      </div>

      <InlineScript html={inlineCall(refreshFeed)} />
      <FeedGuard />
    </div>
  );
}
