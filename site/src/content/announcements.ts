import { sampleEvents } from "./events";
import { photos } from "./photos";
import type { Announcement } from "@/lib/content/types";
import { addDays, laInstant, todayInLA } from "@/lib/dates";

/**
 * Sample announcements. Pages read them through `getAnnouncements()`,
 * never from here.
 *
 * They're placed relative to today, so there's always something live.
 * One is scheduled for later and one has expired, to prove neither shows.
 *
 * TODO(leadership): real announcements. The portal takes these over later.
 */
export function sampleAnnouncements(now: Date): Announcement[] {
  const today = todayInLA(now);
  const at = (offset: number, time = "09:00") => laInstant(addDays(today, offset), time).toISOString();
  const retreat = sampleEvents(now).find((event) => event.slug === "weekend-retreat");

  return [
    {
      id: "sample-retreat-signups",
      title: "Retreat signups are open",
      body: "Spots are limited, so sign up soon. We need a headcount for food and cabins by the Sunday before we leave.",
      photo: photos.cabin,
      pinned: true,
      publishAt: at(-4),
      expiresAt: retreat?.startsAt ?? at(14),
      cta: { label: "See the retreat", href: "/events/weekend-retreat" },
    },
    {
      // TODO(leadership): where to get one, and the price if we show it.
      id: "sample-hoodies",
      title: "Youth hoodies are here",
      body: "Ask at the cafe after youth.",
      pinned: false,
      publishAt: at(-6),
      expiresAt: at(21),
    },
    {
      id: "sample-scheduled",
      title: "Save the date",
      body: "Scheduled for later. It shouldn't show yet.",
      pinned: false,
      publishAt: at(3),
      expiresAt: at(30),
    },
    {
      id: "sample-expired",
      title: "Kickoff photos are up",
      body: "Expired yesterday. It shouldn't show.",
      pinned: false,
      publishAt: at(-8),
      expiresAt: at(-1),
    },
  ];
}
