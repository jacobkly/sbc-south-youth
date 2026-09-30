import { photos } from "./photos";

/** The top of the home page: the poster and the three ways in. */
export const home = {
  hero: {
    title: "Show up as you are.",
    photo: photos.handsRaised,
    // Where to keep the crop on a phone, which shows the middle of a wide photo.
    focus: "62% 50%",
  },

  quickActions: [
    { href: "/visit", icon: "new", title: "I'm new", body: "What a first night looks like." },
    { href: "/connect#join", icon: "chat", title: "Join the chat", body: "For regulars. Ask and a leader adds you." },
    { href: "/parents", icon: "parents", title: "Parents", body: "Safety, leaders, and what to expect." },
  ],

  /**
   * The grid under it. The big tile and the countdown fill themselves from
   * announcements and events, and the big tile shows the first standing
   * note when nothing is posted.
   */
  highlights: {
    eyebrow: "Highlights",
    title: "Don't miss a thing.",
    cafe: { title: "Youth Cafe", body: "Open Sundays and after youth on Fridays." },
    serve: { title: "Find a place to serve", body: "Worship, the cafe, and more, for regulars." },
    leaders: { title: "Meet the team", body: "Who you'll see on a youth night." },
    instagram: { title: "Instagram", body: "Big events and reminders." },
  },
} as const;
