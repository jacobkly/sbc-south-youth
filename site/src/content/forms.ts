import type { ContactRole, StudentBand } from "@/lib/forms/schemas";
import { site } from "./site";

/**
 * What the message forms say after sending or when they can't, and the
 * messages a link can start the Contact form with (`/contact?topic=...`).
 */

export const sent = {
  contact: { title: (name: string) => `Thanks, ${name}!`, body: "Your message is on its way. We'll write back soon." },
  visit: { title: (name: string) => `See you there, ${name}!`, body: "We'll keep an eye out for you. If we miss you, ask for a leader." },
  join: { title: (name: string) => `You're on the list, ${name}!`, body: "A leader will add you to the chat." },
  serve: { title: (name: string) => `Thanks for stepping up, ${name}!`, body: "A leader will reach out." },
};

/** Who's writing in on the Contact form, as the form and the alert email say it. */
export const roleChoices = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent or guardian" },
  { value: "other", label: "Someone else" },
] as const satisfies readonly { value: ContactRole; label: string }[];

/** In school or not, the Join form's optional question. */
export const bandChoices = [
  { value: "hs", label: "In high school" },
  { value: "college", label: "In college" },
  { value: "not-in-school", label: "Not in school" },
] as const satisfies readonly { value: StudentBand; label: string }[];

/** Why a message didn't send. Each one that isn't the person's to fix offers the email instead. */
export const failures = {
  notChecked: `We couldn't check that you're a person, so it didn't send. Try again, or email us at ${site.email}.`,
  notLoaded: `The check that you're a person didn't finish. Turn off any blocker and try again, or email us at ${site.email}.`,
  notSaved: `That didn't send on our end. Try again in a minute, or email us at ${site.email}.`,
  notSetUp: `This form isn't taking messages right now. Email us at ${site.email} instead.`,
};

/** The Contact form's box for asking us to take down a photo. A topic link can check it. */
export const takedown = {
  label: "I'm asking you to take down a photo",
  body: "We'll take it down and let you know.",
};

export const contactTopics: Record<string, { label: string; message: string; takedown?: true }> = {
  parent: {
    label: "A parent's question",
    message: "I'm a parent, and I have a question about ",
  },
  "photo-removal": {
    label: "Photo removal",
    message: "Please take down a photo.\n\nWhere it is (a link or the page): \nWho's in it: ",
    takedown: true,
  },
};
