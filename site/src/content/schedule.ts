import { photos } from "./photos";
import type { WeeklyGathering } from "@/lib/content/types";

/**
 * The nights that repeat every week. Pages read these through
 * `getSchedule()`, never from here. A cancelled night is posted as an
 * announcement instead of changing this file.
 */
export const gatherings: WeeklyGathering[] = [
  {
    slug: "weekly-youth-night",
    title: "Youth Night",
    weekday: 5,
    startTime: "19:30",
    endTime: "21:00",
    description: "Worship and a message, then food, the cafe, and hanging out until about 10.",
    photo: photos.worshipCrowd,
  },
];
