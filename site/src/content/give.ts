import type { FaqItem, Photo } from "@/lib/content/types";
import { photos } from "./photos";
import type { PolicyPoint } from "./safety";

/**
 * The Give page. The cashtag itself never lives here: it comes from the
 * `GIVE_CASHTAG` environment variable, and the page shows a "coming soon"
 * state until it's set.
 *
 * TODO(leadership): the why, the impact examples, and every answer. The
 * receipt and tax wording also need the treasurer's approval.
 */

export type ImpactExample = {
  /** Rough whole dollars, for display only. */
  dollars: number;
  title: string;
  body: string;
  photo: Photo;
};

export const give = {
  why: "Your gift feeds everyone on Friday nights, celebrates birthdays, and covers the extras for events like volleyball. Buying a drink at the Youth Cafe helps too.",

  impact: [
    {
      dollars: 200,
      title: "Friday night food",
      body: "Roughly what pizza and drinks for everyone cost each Friday.",
      photo: photos.pizza,
    },
    {
      dollars: 5,
      title: "Birthday treats",
      body: "Per person. We celebrate everyone's birthday together at the end of each month.",
      photo: photos.cupcakes,
    },
    {
      dollars: 50,
      title: "Volleyball days",
      body: "Drinks and gear when we play, which is a lot in the spring and summer.",
      photo: photos.volleyball,
    },
  ] satisfies ImpactExample[],

  receipt: {
    title: "Getting a receipt",
    body: "Cash App doesn't send donation receipts. Email us your name, the date, and the amount, and the church will send you one.",
    confirmed: false,
  } satisfies PolicyPoint,

  tax: {
    title: "Tax-deductible giving",
    body: "Whether gifts to the youth group are tax-deductible, and what the church needs from you for your records.",
    confirmed: false,
  } satisfies PolicyPoint,

  faq: [
    {
      question: "Is my gift tax-deductible?",
      answer:
        "Placeholder answer until the treasurer approves the wording. It will explain whether gifts to the youth group count as gifts to the church, and what records you need.",
    },
    {
      question: "How do I get a receipt?",
      answer:
        "Cash App doesn't send donation receipts. Email us your name, the date, and the amount of your gift, and the church will send you one.",
    },
    {
      question: "Where does my gift go?",
      answer:
        "Placeholder answer. It will say who manages youth funds, and that gifts pay for Friday night food, birthdays, and events.",
    },
    {
      question: "Can I give by check?",
      answer:
        "Placeholder answer. It will say who to make the check out to, what to write on the memo line, and where to drop it off.",
    },
  ] satisfies FaqItem[],
};
