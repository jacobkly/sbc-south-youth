import type { FaqItem, Photo } from "@/lib/content/types";
import { photos } from "./photos";
import type { PolicyPoint } from "./safety";

/**
 * The Give page. The cashtag itself never lives here: it comes from the
 * `GIVE_CASHTAG` environment variable, and the page shows a "coming soon"
 * state until it's set.
 *
 * TODO(leadership): the why, the impact examples and amounts, and every
 * answer. The receipt and tax wording also need the treasurer's approval.
 */

export type ImpactExample = {
  /** Whole dollars, for display only. */
  dollars: number;
  title: string;
  body: string;
  photo: Photo;
};

export const give = {
  why: "Your gift gets students to camp, fills the snack table, and keeps youth nights running every week.",

  impact: [
    {
      dollars: 15,
      title: "Pizza night",
      body: "Feeds a small group after a youth night.",
      photo: photos.pizza,
    },
    {
      dollars: 50,
      title: "Camp scholarship",
      body: "Covers part of a student's camp fee, so cost isn't the reason they stay home.",
      photo: photos.campfire,
    },
    {
      dollars: 100,
      title: "Worship night gear",
      body: "Strings, cables, and batteries for the band.",
      photo: photos.guitar,
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

  /** The `#camp` section, for people paying for an event. */
  eventPayments: {
    body: "Event payments go to the same Cash App. Put the note from your signup confirmation in the \"For\" line, so we can match the payment to your spot.",
    notDonation: "Event payments pay for the event itself, so they aren't donations and don't get a tax receipt.",
  },

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
        "Placeholder answer. It will say who manages youth funds, and that gifts pay for camps, trips, and youth nights.",
    },
    {
      question: "Can I give by check?",
      answer: "Placeholder answer. It will say who to make the check out to, what to write on the memo line, and where to drop it off.",
    },
  ] satisfies FaqItem[],
};
