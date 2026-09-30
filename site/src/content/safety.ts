import { photos } from "./photos";

/**
 * The Parents page. It only describes what leaders actually do today, so
 * it never mentions screening, training, a written policy, a photo release,
 * or rules for rides.
 *
 * TODO(leadership): the pastor approves this wording before launch.
 */

export type PolicyPoint = {
  title: string;
  body: string;
  /** False until leadership approves this exact wording. */
  confirmed: boolean;
};

export const safety = {
  commitment: {
    leaders: {
      title: "Who leads",
      body: "Every leader is a member of the main church, chosen by the youth leader and the pastor. Leaders bring decisions to the pastors, who have the final say.",
      confirmed: true,
    },
    learning: {
      title: "How leaders learn",
      body: "A new leader shadows the leader they're taking over from.",
      confirmed: true,
    },
    accountability: {
      title: "Accountability",
      body: "Leaders meet every other week to keep each other accountable, hold to the church's standards, and grow closer to Jesus.",
      confirmed: true,
    },
  } satisfies Record<string, PolicyPoint>,

  dropOff: {
    notes: [
      "Drop off and pick up at the front doors, right by the parking lot.",
      "Service ends around 9, and most people hang out until 9:30 or 10. There's no set pick-up time.",
      "Students sort out their own rides, and leaders stay until everyone's been picked up.",
    ],
    photo: photos.entrance,
  },

  communication: {
    chat: {
      title: "The group chat, and church",
      body: "Leaders talk with students in the group chat, and we see each other at church several times a week.",
      confirmed: true,
    },
    trips: {
      title: "Trips and plans",
      body: "Details about trips reach parents through their students, so ask yours what's coming up.",
      confirmed: true,
    },
    events: {
      title: "Big events",
      body: "We announce big events during church, on this site, and on Instagram.",
      confirmed: true,
    },
  } satisfies Record<string, PolicyPoint>,

  photos: {
    body: "We sometimes take photos on Fridays and at events for this site and Instagram.",
    removal: "We don't use a photo release. Ask and we'll take any photo down.",
  },

  /** The youth protection policy PDF, if the church adopts one. The page hides it until then. */
  policyHref: null as string | null,
};
