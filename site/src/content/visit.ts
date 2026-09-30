import { photos } from "./photos";

/**
 * The rest of the Plan a Visit page: parking, the way in, and what a
 * first night looks like.
 */
export const visit = {
  parking: {
    notes: [
      "Park in the church's lot. It's right at the front door.",
      "Come in through the front doors. We meet in the main sanctuary, right ahead of you.",
      "Drop-off and pick-up are at the front doors too.",
    ],
    entrancePhoto: photos.entrance,
  },

  firstNight: [
    {
      title: "Come on in",
      body: "The lot is right out front. Walk in the front doors, and the main sanctuary is right ahead.",
    },
    { title: "Worship", body: "We worship Jesus together, and music is a big deal here." },
    { title: "One message", body: "Everyone together, for a message about Jesus." },
    {
      title: "Food and hanging out",
      body: "Snacks and drinks, often a full meal. The cafe opens, there are a few games, and people hang out until 9:30 or 10.",
    },
  ],

  /** How to find a leader, since nobody waits to greet people. */
  meetALeader: "Leaders try to meet everyone new, but sometimes we miss people. Ask anyone to point you to a leader.",
};
