/** The top of the home page: the poster and the three ways in. */
export const home = {
  hero: {
    // Matches the weekly schedule, which a test checks.
    title: "Fridays at 7:30",
    lede: "Worship and a message, then food and hanging out until 9:30 or 10. High school and college age, all together.",
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
      { time: "7:30 PM", title: "Worship", body: "Worshiping Jesus together, with a live band." },
      { time: "Then", title: "A message", body: "One message about Jesus, for everyone together." },
      { time: "About 9", title: "Food and the cafe", body: "Snacks and drinks, often a full meal, and a few games." },
      { time: "Until 9:30–10", title: "Hanging out", body: "Leaders stay until everyone's been picked up." },
    ],
  },

  /**
   * The grid under it. The big tile and the countdown fill themselves from
   * announcements and events, and the big tile shows the first standing
   * note when nothing is posted.
   */
  highlights: {
    title: "Coming up",
    cafe: { title: "Youth Cafe", body: "Open Sundays and after youth on Fridays. What it makes goes back into youth." },
    serve: { title: "Find a place to serve", body: "Worship, the cafe, and more, for regulars." },
    leaders: { title: "Meet the team", body: "Who you'll see on Fridays." },
    instagram: { title: "Instagram", body: "Big events and reminders." },
  },
} as const;
