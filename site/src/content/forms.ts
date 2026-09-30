/**
 * What the message forms say after sending, and the messages a link can
 * start the Contact form with (`/contact?topic=...`).
 */

export const sent = {
  contact: { title: (name: string) => `Thanks, ${name}!`, body: "Your message is on its way. We'll write back soon." },
  visit: { title: (name: string) => `See you there, ${name}!`, body: "We'll keep an eye out for you. If we miss you, ask for a leader." },
  join: { title: (name: string) => `You're on the list, ${name}!`, body: "A leader will add you to the chat." },
  serve: { title: (name: string) => `Thanks for stepping up, ${name}!`, body: "A leader will reach out." },
};

export const contactTopics: Record<string, { label: string; message: string }> = {
  "photo-removal": {
    label: "Photo removal",
    message: "Please take down a photo.\n\nWhere it is (a link or the page): \nWho's in it: ",
  },
};
