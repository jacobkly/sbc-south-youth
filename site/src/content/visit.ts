import { photos } from "./photos";

/**
 * The rest of the Plan a Visit page: parking, the entrance, and what a
 * first night looks like.
 *
 * TODO(leadership): all of it, once leadership describes a typical night.
 */
export const visit = {
  parking: {
    notes: [
      "Park in the main lot off Example Street. It's free.",
      "Youth uses the side entrance, to the right of the main doors.",
      "Drop-off is at the curb right outside that entrance.",
    ],
    entrancePhoto: photos.entrance,
  },

  firstNight: [
    { title: "Someone says hi", body: "A leader meets you at the door, learns your name, and shows you around." },
    { title: "Hang out", body: "Games, snacks, and time to meet people before things start." },
    { title: "Worship and a message", body: "A few songs from our band, then a short, honest talk about Jesus." },
    { title: "Small groups", body: "Split up by grade to talk it through. Share as much or as little as you want." },
  ],
};
