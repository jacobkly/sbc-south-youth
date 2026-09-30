/**
 * The Connect & Serve page: the three steps and the Join and Serve forms.
 * Group chat links never appear on the site. A leader adds people once
 * they're coming regularly.
 */

export const connect = {
  steps: [
    { id: "come", title: "Come", body: "Show up on a Friday night. No sign-up needed.", href: "/visit", cta: "Plan a visit" },
    {
      id: "connect",
      title: "Connect",
      body: "Keep coming, and once you're a regular, ask to join the group chat.",
      href: "#join",
      cta: "Ask to join",
    },
    { id: "serve", title: "Serve", body: "Once you're a regular, find a place to help out.", href: "#serve", cta: "See where" },
  ],

  join: {
    title: "Join the group chat",
    body: "The chat is for people who come regularly. Once you've been coming for a while, ask here and a leader will add you.",
    linkNote: "Chat links never go on the website, so the chat stays just for our group.",
  },

  serve: {
    title: "Find a place to serve",
    body: "For regulars, who are basically members. Pick the areas you'd like to try, and a leader will reach out.",
  },
} as const;
