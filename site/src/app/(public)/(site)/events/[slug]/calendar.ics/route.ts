import { cacheLife } from "next/cache";
import { formatAddress } from "@/content/site";
import { getBySlug, getEventSlugs } from "@/lib/content/loaders";
import { calendarFile, calendarResponse, eventEntry, gatheringEntry } from "@/lib/ics";

export async function generateStaticParams() {
  return (await getEventSlugs()).map((slug) => ({ slug }));
}

/** One event, or a weekly night that repeats from its next date. A cancelled event has no file. */
async function fileFor(slug: string): Promise<string | null> {
  "use cache";
  cacheLife("feed");

  const content = await getBySlug(slug);
  if (!content || (content.kind === "event" && content.event.cancelled)) return null;
  const now = new Date();
  const church = formatAddress();
  const entry =
    content.kind === "event" ? eventEntry(content.event, church) : gatheringEntry(content.gathering, church, now);
  return calendarFile([entry], { stamp: now });
}

export async function GET(_request: Request, { params }: RouteContext<"/events/[slug]/calendar.ics">) {
  const { slug } = await params;
  const file = await fileFor(slug);
  if (!file) return new Response("Not found", { status: 404 });
  return calendarResponse(file, `${slug}.ics`, "attachment");
}
