import { z } from "zod";
import { isIsoDate, laDateOf, laInstant, laTimeOf } from "@/lib/dates";

/** The database's limits on a heads-up. */
export const POST_LIMITS = { title: 80, body: 280, link: 500, linkLabel: 24 } as const;

export const POST_TONES = ["info", "cancellation"] as const;
export type PostTone = (typeof POST_TONES)[number];

/** The composer's fields, as the form holds them. */
export type PostValues = {
  title: string;
  body: string;
  /** Blank for no button. */
  linkUrl: string;
  /** Blank lets the site use its own button text. */
  linkLabel: string;
  tone: string;
  pinned: boolean;
  /** Blank for now, or the Los Angeles clock as "YYYY-MM-DDTHH:MM", a date and time picker's value. */
  startsAt: string;
  endsAt: string;
};

/** A checked heads-up, as the columns a site editor can write. */
export type PostFields = {
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  tone: PostTone;
  pinned: boolean;
  starts_at: string;
  ends_at: string;
};

export type PostErrors = Partial<
  Record<"title" | "body" | "linkUrl" | "linkLabel" | "tone" | "startsAt" | "endsAt", string>
>;

export type PostCheck = { ok: true; post: PostFields } | { ok: false; errors: PostErrors };

const MESSAGES = {
  title: "Give it a title.",
  titleLength: `Keep the title to ${POST_LIMITS.title} characters or fewer.`,
  bodyLength: `Keep it to ${POST_LIMITS.body} characters or fewer.`,
  link: "Use a link that starts with https://, or a page on the site like /this-week.",
  linkSpaces: "Take the spaces out of the link.",
  linkLength: `Keep the link to ${POST_LIMITS.link} characters or fewer.`,
  labelLength: `Keep the button text to ${POST_LIMITS.linkLabel} characters or fewer.`,
  labelWithoutLink: "Add a link for the button, or clear its text.",
  tone: "Pick what kind of heads-up this is.",
  start: "Pick a start date and time.",
  end: "Pick when it comes down.",
  endBeforeStart: "Pick an end after the start.",
  endPassed: "That time has already passed. Pick a later one.",
};

/** A page on this site. A second slash or a backslash would make browsers go to another host. */
const SITE_PATH = /^\/(?![/\\])[^\\]*$/;
/** Something like example.com/merch, typed without https://. */
const BARE_ADDRESS = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i;

/** The link to save, or why it can't be. Blank means no link. */
function checkLink(raw: string): { url: string | null } | { error: string } {
  const value = raw.trim();
  if (!value) return { url: null };
  if (/\s/.test(value)) return { error: MESSAGES.linkSpaces };
  const url = BARE_ADDRESS.test(value) ? `https://${value}` : value;
  if (url.length > POST_LIMITS.link) return { error: MESSAGES.linkLength };
  if (SITE_PATH.test(url)) return { url };
  if (!url.toLowerCase().startsWith("https://")) return { error: MESSAGES.link };
  try {
    if (!new URL(url).hostname) return { error: MESSAGES.link };
  } catch {
    return { error: MESSAGES.link };
  }
  return { url };
}

const text = z.preprocess((value) => (typeof value === "string" ? value : ""), z.string());

const postSchema = z.object({
  title: text
    .transform((value) => value.trim())
    .pipe(z.string().min(1, MESSAGES.title).max(POST_LIMITS.title, MESSAGES.titleLength)),
  body: text
    .transform((value) => value.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(POST_LIMITS.body, MESSAGES.bodyLength)),
  linkUrl: text.transform((value, context) => {
    const link = checkLink(value);
    if ("url" in link) return link.url;
    context.addIssue({ code: "custom", message: link.error });
    return z.NEVER;
  }),
  linkLabel: text
    .transform((value) => value.trim())
    .pipe(z.string().max(POST_LIMITS.linkLabel, MESSAGES.labelLength)),
  tone: z.enum(POST_TONES, MESSAGES.tone),
  pinned: z.preprocess((value) => value === true, z.boolean()),
  startsAt: text.transform((value, context) => {
    if (!value.trim()) return null;
    const start = fromLocalInput(value.trim());
    if (start) return start;
    context.addIssue({ code: "custom", message: MESSAGES.start });
    return z.NEVER;
  }),
  endsAt: text.transform((value, context) => {
    const end = fromLocalInput(value.trim());
    if (end) return end;
    context.addIssue({ code: "custom", message: MESSAGES.end });
    return z.NEVER;
  }),
});

/**
 * Checks the composer. Every problem comes back at once, keyed by field,
 * in words the form can show as they are. A blank start means now, or,
 * for a heads-up that's already up, `keepStart`, so editing it doesn't
 * move it.
 */
export function checkPost(input: unknown, { now, keepStart }: { now: Date; keepStart?: Date }): PostCheck {
  const fields = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: PostErrors = {};

  // Field by field, so the checks across fields still run when one of them has a problem.
  const values: Partial<z.output<typeof postSchema>> = {};
  for (const key of Object.keys(postSchema.shape) as (keyof typeof postSchema.shape)[]) {
    const result = postSchema.shape[key].safeParse(fields[key]);
    if (result.success) Object.assign(values, { [key]: result.data });
    else errors[key as keyof PostErrors] = result.error.issues[0]?.message;
  }

  const { title, body, linkUrl, linkLabel, tone, pinned, startsAt, endsAt } = values;
  if (linkLabel && linkUrl === null) errors.linkLabel = MESSAGES.labelWithoutLink;
  const start = startsAt === undefined ? undefined : (startsAt ?? keepStart ?? now);
  if (endsAt && endsAt <= now) errors.endsAt = MESSAGES.endPassed;
  else if (endsAt && start && endsAt <= start) errors.endsAt = MESSAGES.endBeforeStart;

  if (
    Object.keys(errors).length > 0 ||
    title === undefined ||
    body === undefined ||
    linkUrl === undefined ||
    tone === undefined ||
    !start ||
    !endsAt
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    post: {
      title,
      body,
      link_url: linkUrl,
      link_label: linkLabel || null,
      tone,
      pinned: pinned ?? false,
      starts_at: start.toISOString(),
      ends_at: endsAt.toISOString(),
    },
  };
}

/** An instant as a date and time picker's value, on the Los Angeles clock. */
export function toLocalInput(instant: Date | string): string {
  return `${laDateOf(instant)}T${laTimeOf(instant)}`;
}

/** A date and time picker's value, read on the Los Angeles clock, or null when it isn't one. */
export function fromLocalInput(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/.exec(value);
  if (!match || !isIsoDate(match[1])) return null;
  try {
    return laInstant(match[1], match[2]);
  } catch {
    return null;
  }
}
