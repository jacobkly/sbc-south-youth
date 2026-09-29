/**
 * The Connect & Serve page: the three steps, how small groups work, and
 * the Join and Serve forms. Group chat links never appear on the site.
 * A leader sends one after someone asks to join.
 *
 * The forms check against this file, so it ships to the browser. Keep
 * it to plain text, with no imports.
 *
 * TODO(leadership): the groups we offer, how small groups work, who
 * checks a request before sending a link, and how a parent or guardian
 * is kept in the loop for high school students.
 */

export const connect = {
  steps: [
    { id: "come", title: "Come", body: "Show up on a youth night. No sign-up needed.", href: "/visit", cta: "Plan a visit" },
    { id: "connect", title: "Connect", body: "Get in the group chat and find a small group.", href: "#join", cta: "Join a group" },
    { id: "serve", title: "Serve", body: "Use what you're good at on a team.", href: "#serve", cta: "Find a team" },
  ],

  smallGroups: {
    title: "Where people get to know you",
    body: "Youth nights are big. Small groups are a few people your age and a leader, and they're where friendships start.",
    points: [
      { title: "By grade", body: "High school and college meet separately, with a leader for each group." },
      { title: "After the message", body: "Groups meet on youth nights to talk it through." },
      { title: "Share if you want", body: "Say as much or as little as you like. Listening is fine." },
    ],
  },

  join: {
    title: "Join a group",
    body: "Tell us who you are and a leader will send you the link. Chat links never go on the website.",
    // What someone can ask to join. The grade band decides which chat.
    options: [
      { id: "chat", title: "The group chat", body: "Reminders and what's on each week." },
      { id: "small-group", title: "A small group", body: "A few people your age and a leader." },
      { id: "both", title: "Both", body: "The chat and a small group." },
    ],
    linkNote: "A leader checks every request before sending a link, so the chats stay just for our students.",
    parentNote: "For high school students, we keep a parent or guardian in the loop.",
  },

  serve: {
    title: "Find a team",
    body: "Pick the teams you'd like to try, and the team leader will reach out.",
  },
} as const;

export type JoinOptionId = (typeof connect.join.options)[number]["id"];
