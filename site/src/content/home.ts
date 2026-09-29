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
    { href: "/connect#join", icon: "chat", title: "Join the chat", body: "Ask to join the group chat." },
    { href: "/parents", icon: "parents", title: "Parents", body: "Safety, leaders, and what to expect." },
  ],

  /** The grid under it. The big tile and the countdown fill themselves from announcements and events. */
  highlights: {
    eyebrow: "Highlights",
    title: "Don't miss a thing.",
    // The big tile when nothing is posted.
    quiet: {
      title: "See what's on this week.",
      body: "Youth nights, events, and news, all in one place.",
      photo: photos.bibleStudyOutside,
      cta: "Open This Week",
    },
    leaders: { title: "Meet the team", body: "Who you'll see on a youth night." },
    serve: { title: "Serve on a team", body: "Help make youth nights happen." },
    give: { title: "Give", body: "Help students get to camp." },
    follow: { title: "Follow along", body: "Find us on social." },
  },
} as const;
