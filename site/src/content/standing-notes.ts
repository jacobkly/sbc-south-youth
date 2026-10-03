import { site } from "./site";
import type { StandingNote } from "@/lib/content/types";

const instagram = site.socials.find((social) => social.kind === "instagram");

/**
 * Heads up notes that are always true. This Week shows them after the
 * posts. The portal takes over posts later, but these stay a code edit.
 */
export const standingNotes: StandingNote[] = [
  {
    id: "bring-a-friend",
    title: "Bring a friend",
    body: "Invite someone who's never been. Send them the Plan a visit page so they know what to expect.",
    spot: "bring-a-friend",
    cta: { label: "Plan a visit", href: "/visit" },
  },
  {
    id: "youth-cafe",
    title: "The Youth Cafe",
    body: "Open on Sundays and after youth on Fridays. Youth members run it for the whole church, and what it makes goes back into youth.",
    spot: "youth-cafe",
    cta: { label: "Serve at the cafe", href: "/connect#serve" },
  },
  ...(instagram
    ? [
        {
          id: "instagram",
          title: "We're on Instagram",
          body: "Big events and reminders go up there too.",
          cta: { label: "Follow on Instagram", href: instagram.href },
        },
      ]
    : []),
];
