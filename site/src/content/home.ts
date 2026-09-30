import { photos } from "./photos";

/** The top of the home page: the poster and the three ways in. */
export const home = {
  hero: {
    // Matches the weekly schedule, which a test checks.
    title: "Fridays at 7:30",
    lede: "Worship and a message, then pizza and hanging out until about 10. High school and college students, all together.",
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
   * A Friday from start to finish, for wide screens. Only the start is a
   * set time, so the rest stay rough.
   */
  friday: {
    title: "A Friday night",
    stops: [
      { time: "7:30 PM", title: "Worship", body: "Led by the band that plays on Sundays." },
      { time: "Then", title: "A message", body: "Everyone together, high school and college." },
      { time: "About 9", title: "Food and the cafe", body: "Pizza and drinks, often a full meal, and a few games." },
      { time: "Until about 10", title: "Hanging out", body: "Leaders stay until everyone's been picked up." },
    ],
  },

  /**
   * The grid under it. The big tile and the countdown fill themselves from
   * announcements and events, and the big tile shows the first standing
   * note when nothing is posted.
   */
  highlights: {
    title: "Coming up",
    cafe: { title: "Youth Cafe", body: "Open Sundays and after youth on Fridays." },
    serve: { title: "Find a place to serve", body: "Worship, the cafe, and more, for regulars." },
    leaders: { title: "Meet the team", body: "Who you'll see on a youth night." },
    instagram: { title: "Instagram", body: "Big events and reminders." },
  },
} as const;
