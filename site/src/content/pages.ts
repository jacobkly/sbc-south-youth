/**
 * Each page's name, search description, and headline. The page, its tab
 * title, and its link preview image all read from here, so they match.
 */

export type PageCopy = {
  path: string;
  /** The tab title and the name in search results, like "Plan a Visit". */
  title: string;
  /** The line under the title in search results and link previews. */
  description: string;
  /** The small label over the headline. */
  eyebrow: string;
  /** The big headline at the top of the page. */
  heading: string;
};

export const pages = {
  thisWeek: {
    path: "/this-week",
    title: "This Week",
    description: "Youth nights, events, and announcements for the next few weeks.",
    eyebrow: "This Week",
    heading: "What's happening.",
  },
  visit: {
    path: "/visit",
    title: "Plan a Visit",
    description: "When and where youth meets, where to park, and what to expect on your first night.",
    eyebrow: "Plan a visit",
    heading: "Your first night, sorted.",
  },
  connect: {
    path: "/connect",
    title: "Connect & Serve",
    description: "Come on a Friday, join the group chat once you're a regular, and find a place to serve.",
    eyebrow: "Connect & Serve",
    heading: "Come. Connect. Serve.",
  },
  parents: {
    path: "/parents",
    title: "Parents & Safety",
    description:
      "How we look after students, what a typical night looks like, drop-off and pick-up, and how to reach the youth pastor.",
    eyebrow: "Parents & Safety",
    heading: "For parents.",
  },
  leaders: {
    path: "/leaders",
    title: "Leaders",
    description: "Meet the people who lead youth nights, and how to reach them.",
    eyebrow: "Leaders",
    heading: "Meet the team.",
  },
  give: {
    path: "/give",
    title: "Give",
    description: "Give to SBC South Youth with Cash App, and see what your gift does.",
    eyebrow: "Give",
    heading: "Fuel the mission.",
  },
  contact: {
    path: "/contact",
    title: "Contact",
    description: "Questions about youth nights, events, or anything else? Send us a message.",
    eyebrow: "Contact",
    heading: "Say hi.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy",
    description: "What our forms collect, why we ask, and how long we keep it.",
    eyebrow: "Privacy",
    heading: "Your privacy, in plain words.",
  },
  links: {
    path: "/links",
    title: "Links",
    description: "This week, plan a visit, join the chat, and everywhere else to find SBC South Youth.",
    eyebrow: "Links",
    heading: "SBC South Youth",
  },
} satisfies Record<string, PageCopy>;
