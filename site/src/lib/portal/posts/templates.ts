import type { PresetId } from "./presets";
import type { PostTone, PostValues } from "./schema";

/** A quick start for a common heads-up. Everything it fills in can be changed. */
export type PostTemplate = {
  id: string;
  label: string;
  values: Omit<PostValues, "startsAt" | "endsAt"> & { tone: PostTone };
  /** How long it usually stays up. */
  preset: PresetId;
};

export const TEMPLATES: PostTemplate[] = [
  {
    id: "cancellation",
    label: "Cancellation",
    values: {
      title: "No youth tonight",
      body: "We're taking tonight off. See you next time!",
      linkUrl: "",
      linkLabel: "",
      tone: "cancellation",
      pinned: true,
    },
    preset: "tonight",
  },
  {
    id: "merch",
    label: "Merch back in stock",
    values: {
      title: "Merch is back in stock",
      body: "New merch just came in. Grab yours before it's gone.",
      linkUrl: "",
      linkLabel: "",
      tone: "info",
      pinned: false,
    },
    preset: "week",
  },
  {
    id: "event",
    label: "Special event",
    values: {
      title: "Something special this Friday",
      body: "Bring a friend. The details are on This Week.",
      linkUrl: "/this-week",
      linkLabel: "See This Week",
      tone: "info",
      pinned: true,
    },
    preset: "friday",
  },
];
