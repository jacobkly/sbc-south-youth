import { photos } from "./photos";
import type { SiteEvent } from "@/lib/content/types";
import { addDays, laInstant, laMidnight, todayInLA, weekdayOf, type IsoDate } from "@/lib/dates";

/**
 * Sample events. Pages read events through `getEvents()`, never from here.
 *
 * They're placed relative to the current week, so This Week, the event
 * pages, and Home always have something to show while the site is
 * designed. One has already happened and one is past the 8-week agenda,
 * to show how those look.
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
      description: "A big night to start the season: games, worship, food trucks, and a first look at what's coming up.",
      startsAt: at(-3, "18:00"),
      endsAt: at(-3, "21:00"),
      allDay: false,
      locationName: "Youth Room",
      photo: photos.crowdSilhouette,
      featured: false,
    },
    {
      id: "sample-serve-saturday",
      slug: "serve-saturday",
      title: "Serve Saturday: Park Cleanup",
      description:
        "We're spending the morning cleaning up the park down the street. Wear clothes that can get dirty and bring a water bottle.\n\nGloves, bags, and snacks are on us.",
      startsAt: at(5, "09:00"),
      endsAt: at(5, "12:00"),
      allDay: false,
      locationName: "Example Community Park",
      locationAddress: "400 Example Avenue, Anytown, CA 00000",
      photo: photos.friendsOutside,
      featured: false,
    },
    {
      id: "sample-newcomer-lunch",
      slug: "newcomer-lunch",
      title: "Newcomer Lunch",
      description:
        "New here, or bringing someone who is? Grab lunch with a few leaders after church, meet some people, and ask anything.",
      startsAt: at(6, "12:30"),
      endsAt: at(6, "13:30"),
      allDay: false,
      locationName: "Fellowship Hall",
      photo: photos.pizzaTable,
      costNote: "Free",
      featured: false,
    },
    {
      id: "sample-weekend-retreat",
      slug: "weekend-retreat",
      title: "Weekend Retreat",
      description:
        "Two nights away with the whole group: worship around the fire, games, time outside, and a lot of good food.\n\nWe leave from the church parking lot on Friday and are back Sunday by lunch. A packing list goes out the week before.",
      startsAt: at(11, "17:00"),
      endsAt: at(13, "12:00"),
      allDay: false,
      locationName: "Example Pines Camp",
      locationAddress: "1 Example Pines Road, Mountainville, CA 00000",
      photo: photos.cabin,
      costNote: "$40 per student",
      featured: true,
    },
    {
      id: "sample-worship-night",
      slug: "worship-night",
      title: "Worship Night",
      description: "One long night of worship and prayer with both groups together. Bring a friend.",
      startsAt: at(18, "19:00"),
      endsAt: at(18, "21:00"),
      allDay: false,
      locationName: "Main Sanctuary",
      photo: photos.stageLights,
      featured: true,
    },
    {
      id: "sample-beach-day",
      slug: "beach-day",
      title: "Beach Day",
      description:
        "A whole day at the beach. We carpool from the church in the morning and head home once the sun sets.\n\nBring sunscreen, a towel, and a lunch.",
      ...allDay(19),
      locationName: "Example State Beach",
      locationAddress: "900 Example Coast Highway, Beachtown, CA 00000",
      photo: photos.friendsLaughing,
      costNote: "$10 for gas and snacks",
      featured: false,
    },
    {
      id: "sample-college-game-night",
      slug: "college-game-night",
      title: "College Game Night",
      description: "Board games, card games, and way too much pizza. Come after class and stay as long as you like.",
      startsAt: at(22, "19:30"),
      endsAt: at(22, "22:00"),
      allDay: false,
      locationName: "The Loft",
      photo: photos.pizza,
      featured: false,
    },
    {
      id: "sample-parent-info-night",
      slug: "parent-info-night",
      title: "Parent Info Night",
      description:
        "Parents, meet the leaders, hear what's coming up this season, and ask us anything about trips, safety, and how to get involved.",
      startsAt: at(27, "12:30"),
      endsAt: at(27, "13:30"),
      allDay: false,
      locationName: "Youth Room",
      featured: false,
    },
    {
      id: "sample-lock-in",
      slug: "lock-in",
      title: "Lock-In",
      description:
        "An all-nighter at the church: dodgeball, movies, worship, and breakfast at sunrise.\n\nPickup is at 8 AM.",
      startsAt: at(33, "20:00"),
      endsAt: at(34, "08:00"),
      allDay: false,
      locationName: "Gym",
      photo: photos.gym,
      costNote: "$15, includes breakfast",
      featured: false,
    },
    {
      id: "sample-car-wash",
      slug: "car-wash",
      title: "Car Wash Fundraiser",
      description: "Help raise money for this year's trips and camps. Bring your car, your friends, or both.",
      startsAt: at(40, "09:00"),
      endsAt: at(40, "14:00"),
      allDay: false,
      locationName: "Church parking lot",
      costNote: "By donation",
      featured: false,
    },
    {
      id: "sample-campout",
      slug: "all-church-campout",
      title: "All-Church Campout",
      description: "A weekend of camping with the whole church. Families, students, and leaders all together.",
      ...allDay(74, 76),
      locationName: "Example Lake Campground",
      locationAddress: "2 Example Lake Road, Laketown, CA 00000",
      photo: photos.campfireChairs,
      featured: false,
    },
  ];
}
