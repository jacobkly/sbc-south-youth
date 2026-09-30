import { photos } from "./photos";

/**
 * The rest of the Plan a Visit page: parking, the way in, and what a
 * first night looks like.
 */
export const visit = {
  parking: {
    notes: [
      "Park in the church's lot. It's right at the front door.",
      "Come in through the front doors.",
      "Drop-off and pick-up are at the front doors too.",
    ],
    entrancePhoto: photos.entrance,
  },

  firstNight: [
    { title: "Come on in", body: "The lot is right out front, so walk straight in the front doors." },
    { title: "Worship", body: "Music is a big deal here. The band is usually the same team that leads on Sunday." },
    { title: "One message", body: "Everyone together, high school and college, for a message about Jesus." },
    {
      title: "Food and hanging out",
      body: "Pizza and drinks, often a full meal. The cafe opens, there are a few games, and people hang out until about 10.",
    },
  ],

  /** How to find a leader, since nobody waits to greet people. */
  meetALeader: "Leaders try to meet everyone new, but sometimes we miss people. Ask anyone to point you to a leader.",
};
