import { photos } from "./photos";

/**
 * The Parents & Safety page. Anything that describes a church policy is a
 * `PolicyPoint`, and it shows a "To confirm" tag until leadership signs off
 * on the wording. The text here describes what goes in each spot; it never
 * claims a policy the church hasn't adopted.
 *
 * TODO(leadership): every policy point, the drop-off details, the photo
 * wording, and the policy document.
 */

export type PolicyPoint = {
  title: string;
  body: string;
  /** False until leadership approves this exact wording. */
  confirmed: boolean;
};

export const safety = {
  /**
   * The line under the leader cards. It stays hidden until it's confirmed,
   * since it's a promise about every adult who serves.
   */
  screeningLine: {
    text: "Every adult who serves with students is screened and trained.",
    confirmed: false,
  },

  commitment: {
    screening: {
      title: "Screening",
      body: "How adults are screened before they serve with students, as the church has adopted it.",
      confirmed: false,
    },
    training: {
      title: "Training",
      body: "The training leaders complete, and how often they renew it.",
      confirmed: false,
    },
    supervision: {
      title: "Supervision",
      body: "How leaders supervise students on youth nights and trips.",
      confirmed: false,
    },
  } satisfies Record<string, PolicyPoint>,

  dropOff: {
    notes: [
      "Drop off at the curb outside the side entrance, to the right of the main doors.",
      "Doors open 15 minutes before things start.",
      "Pick up at the same door when the night ends.",
    ],
    photo: photos.entrance,
  },

  communication: {
    messaging: {
      title: "Group messages",
      body: "How leaders message students, which apps they use, and when.",
      confirmed: false,
    },
    parents: {
      title: "Keeping parents in the loop",
      body: "How parents hear about events, trips, and changes to the schedule.",
      confirmed: false,
    },
    rides: {
      title: "Rides and meeting up",
      body: "Our rules for driving students and for meeting outside of youth nights.",
      confirmed: false,
    },
  } satisfies Record<string, PolicyPoint>,

  photos: {
    body: "We sometimes take photos at youth nights and events for this site and our social accounts.",
    release: {
      title: "Photo releases",
      body: "How we ask for permission before a student's photo is posted.",
      confirmed: false,
    } satisfies PolicyPoint,
  },

  /** The youth protection policy PDF, once leadership shares one. */
  policyHref: null as string | null,
};
