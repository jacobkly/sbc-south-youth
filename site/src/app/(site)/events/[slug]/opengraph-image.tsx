import { notFound } from "next/navigation";
import { getEventSlugs } from "@/lib/content/loaders";
import { eventView } from "@/lib/event-view";
import { sharePhoto, sharePoster } from "@/lib/share-image";
import { SHARE_SIZE } from "@/lib/share";

export const alt = "An event poster with its name, date, and time";
export const size = SHARE_SIZE;
export const contentType = "image/png";

// Made when the site builds, like the pages.
export async function generateStaticParams() {
  return (await getEventSlugs()).map((slug) => ({ slug }));
}

/** The event's photo as a poster, with when and where over it. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await eventView(slug);
  if (!view) notFound();

  return sharePoster({
    eyebrow: view.date,
    title: view.title,
    detail: [view.time, view.locationName].filter(Boolean).join(" · "),
    photo: view.photo ? await sharePhoto(view.photo.src) : null,
    seed: view.slug,
  });
}
