import type { FaqItem } from "@/lib/content/types";

/**
 * First-visit questions on the Plan a Visit page.
 *
 * TODO(leadership): every answer is a placeholder until leadership
 * confirms it, especially pick-up times.
 */
export const visitFaq: FaqItem[] = [
  {
    question: "What should I wear?",
    answer: "Whatever you'd wear to school or to hang out with friends. Nobody dresses up.",
  },
  {
    question: "Do I need to know anyone?",
    answer:
      "Nope. Lots of people come the first time on their own. Someone at the door will say hi, show you around, and introduce you to people in your grade.",
  },
  {
    question: "Do I have to sing or pray out loud?",
    answer: "Never. Join in as much or as little as you want. You're welcome to just listen.",
  },
  {
    question: "Is there food?",
    answer: "Yes, usually snacks, and sometimes a full dinner. If you have an allergy, tell a leader when you arrive.",
  },
  {
    question: "Can I bring a friend?",
    answer: "Please do. Coming with a friend is the easiest way to try it out.",
  },
  {
    question: "What happens after?",
    answer: "Most people hang out for a bit. There's no pressure to sign up for anything or come back.",
  },
  {
    question: "When do parents pick up?",
    answer:
      "Youth night ends at 9 PM. Pick-up is at the front entrance, and a leader stays until every student has a ride.",
  },
];
