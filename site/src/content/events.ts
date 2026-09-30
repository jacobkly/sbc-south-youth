import { photos } from "./photos";
import type { SiteEvent } from "@/lib/content/types";
import { addDays, laInstant, laMidnight, todayInLA, weekdayOf, type IsoDate } from "@/lib/dates";

/**
 * Sample events. Pages read events through `getEvents()`, never from here.
 *
 * They're placed relative to the current week, so This Week, the event
 * pages, and Home always have something to show while the site is
 * designed. There are only a few, like the real calendar, and none are on
 * a Friday night. One has already happened and one is past the 8-week
 * agenda, to show how those look.
 *
 * TODO(leadership): real events. The portal takes these over later.
 */
export function sampleEvents(now: Date): SiteEvent[] {
  const today = todayInLA(now);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  // A day of this week (0 is Monday) or a later one, and a time that day.
  const day = (offset: number): IsoDate => addDays(monday, offset);
  const at = (offset: number, time: string) => laInstant(day(offset), time).toISOString();
  const allDay = (first: number, last = first) => ({
    allDay: true,
    startsAt: laMidnight(day(first)).toISOString(),
    endsAt: laMidnight(day(last + 1)).toISOString(),
  });

  return [
    {
      id: "sample-kickoff-night",
      slug: "kickoff-night",
      title: "Kickoff Night",
      description: "A big night to start the season: worship, food, and a first look at what's coming up.",
      startsAt: at(-2, "18:00"),
      endsAt: at(-2, "21:00"),
      allDay: false,
      locationName: "SBC South",
      photo: photos.crowdSilhouette,
      featured: false,
    },
    {
      id: "sample-volleyball",
      slug: "volleyball-saturday",
      title: "Volleyball Saturday",
      description:
        "Come play or come watch. Every skill level is welcome, and drinks are on us.\n\nBring a water bottle and shoes you can run in.",
      startsAt: at(5, "14:00"),
      endsAt: at(5, "17:00"),
      allDay: false,
      locationName: "Example Park",
      locationAddress: "400 Example Avenue, Maple Valley, WA 98038",
      photo: photos.volleyball,
      costNote: "Free",
      featured: false,
    },
    {
      id: "sample-weekend-retreat",
      slug: "weekend-retreat",
      title: "Weekend Retreat",
      description:
        "A night away with the whole group: worship around the fire, games, time outside, and a lot of good food.\n\nWe leave from the church parking lot Saturday morning and are back Sunday by lunch. A packing list goes out the week before.",
      startsAt: at(12, "09:00"),
      endsAt: at(13, "12:00"),
      allDay: false,
      locationName: "Example Pines Camp",
      locationAddress: "1 Example Pines Road, Exampleville, WA 00000",
      photo: photos.cabin,
      costNote: "$40 per student",
      featured: true,
    },
    {
      id: "sample-worship-night",
      slug: "worship-night",
      title: "Worship Night",
      description: "A long evening of worship and prayer. Bring a friend.",
      startsAt: at(20, "18:00"),
      endsAt: at(20, "20:00"),
      allDay: false,
      locationName: "SBC South",
      photo: photos.stageLights,
      featured: true,
    },
    {
      id: "sample-serve-day",
      slug: "serve-day",
      title: "Serve Day",
      description:
        "Help get the church ready for the season: yard work, cleaning, and setting up rooms. Come for any part of the day.\n\nLunch is on us.",
      ...allDay(26),
      locationName: "SBC South",
      featured: false,
    },
    {
      id: "sample-campout",
      slug: "all-church-campout",
      title: "All-Church Campout",
      description: "A weekend of camping with the whole church. Families, students, and leaders all together.",
      ...allDay(75, 76),
      locationName: "Example Lake Campground",
      locationAddress: "2 Example Lake Road, Exampleville, WA 00000",
      photo: photos.campfireChairs,
      featured: false,
    },
  ];
}
