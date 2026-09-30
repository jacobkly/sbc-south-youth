/**
 * Each page's name, search description, and headline. The page, its tab
 * title, and its link preview image all read from here, so they match.
 *
 * Headlines name the thing or state a fact, with no slogans and no
 * trailing period.
 */

export type PageCopy = {
  path: string;
  /** The tab title, the name in search results, and the label on the link preview, like "Plan a Visit". */
  title: string;
  /** The line under the title in search results and link previews. */
  description: string;
  /** The big headline at the top of the page. */
  heading: string;
};

export const pages = {
  thisWeek: {
    path: "/this-week",
    title: "This Week",
    description: "Friday nights, events, and announcements for the next few weeks.",
    heading: "Events and news",
  },
  visit: {
    path: "/visit",
    title: "Plan a Visit",
    description: "Fridays at 7:30 pm. Where to park, which doors to use, and what your first night looks like.",
    heading: "Your first Friday",
  },
  connect: {
    path: "/connect",
    title: "Connect & Serve",
    description: "Join the group chat once you're coming regularly, and find a place to serve.",
    heading: "After your first Friday",
  },
  parents: {
    path: "/parents",
    title: "Parents & Safety",
    description:
      "How we look after students, what a typical night looks like, drop-off and pick-up, and how to reach a leader.",
    heading: "What parents should know",
  },
  leaders: {
    path: "/leaders",
    title: "Leaders",
    description: "The people who lead youth on Friday nights.",
    heading: "Youth leaders",
  },
  give: {
    path: "/give",
    title: "Give",
    description: "Give to SBC South Youth, and see what your gift pays for: Friday night food, birthdays, and events.",
    heading: "Pizza, birthdays, and volleyball",
  },
  contact: {
    path: "/contact",
    title: "Contact",
    description: "Questions about youth nights, events, or anything else? Send us a message.",
    heading: "Send us a message",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy",
    description: "What our forms collect, why we ask, and how long we keep it.",
    heading: "Privacy",
  },
  links: {
    path: "/links",
    title: "Links",
    description: "This week, plan a visit, join the chat, and everywhere else to find SBC South Youth.",
    heading: "SBC South Youth",
  },
} satisfies Record<string, PageCopy>;
