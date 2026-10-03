import { z } from "zod";
import { cashtagPattern } from "./cash-app";

/**
 * Server environment variables. They're read at build time for static
 * pages, so a change needs a redeploy. Every one is optional until the
 * site goes live: pages show a placeholder when a value is missing.
 */
const serverSchema = z.object({
  /** The Cash App cashtag on the Give page, e.g. "$ExampleYouth". */
  GIVE_CASHTAG: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(
      z
        .string()
        .regex(cashtagPattern, "must be a $ followed by up to 20 letters, numbers, or underscores")
        .optional(),
    )
    .optional(),
  /**
   * A church-owned number that takes texts, for "let us know you're
   * coming". Never a leader's personal cell. Any US format works.
   */
  CHURCH_TEXT_NUMBER: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(
      z
        .string()
        .transform((value) => value.replace(/[\s().-]/g, "").replace(/^\+?1?(\d{10})$/, "+1$1"))
        .pipe(z.string().regex(/^\+1\d{10}$/, "must be a US phone number"))
        .optional(),
    )
    .optional(),
});

export type ServerEnv = { giveCashtag: string | null; textNumber: string | null };

/** Validates the server variables, naming any bad one in the error. */
export function readServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Invalid environment variables: ${problems.join("; ")}`);
  }
  return { giveCashtag: result.data.GIVE_CASHTAG ?? null, textNumber: result.data.CHURCH_TEXT_NUMBER ?? null };
}

export type AppEnv = "production" | "staging";

export type PortalEnv = {
  /** Staging is the dev branch's preview. It shares production's data, so it never writes. */
  appEnv: AppEnv;
  /** Where the portal links for reimbursements. */
  financesUrl: string;
  /** The portal's own address, for links in emails. */
  portalUrl: string;
};

const blankAsMissing = z
  .string()
  .trim()
  .transform((value) => value || undefined);

const webAddress = z.url({ protocol: /^https?$/, error: "must be an http or https address" });

const portalSchema = z.object({
  APP_ENV: blankAsMissing.pipe(z.enum(["production", "staging"]).optional()).optional(),
  /** Set by Vercel on every build: production, preview, or development. */
  VERCEL_ENV: z.string().optional(),
  FINANCES_URL: blankAsMissing.pipe(webAddress.optional()).optional(),
  PORTAL_URL: blankAsMissing.pipe(webAddress.optional()).optional(),
});

/**
 * The portal's server variables, naming any bad one in the error. Without
 * APP_ENV, a Vercel preview counts as staging, so forgetting to set it
 * can't let a preview write real data.
 */
export function readPortalEnv(source: Record<string, string | undefined> = process.env): PortalEnv {
  const result = portalSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Invalid environment variables: ${problems.join("; ")}`);
  }
  const { APP_ENV, VERCEL_ENV, FINANCES_URL, PORTAL_URL } = result.data;
  return {
    appEnv: APP_ENV ?? (VERCEL_ENV === "preview" ? "staging" : "production"),
    financesUrl: (FINANCES_URL ?? "https://finances.sbcsouthyouth.com").replace(/\/+$/, ""),
    portalUrl: (PORTAL_URL ?? "https://portal.sbcsouthyouth.com").replace(/\/+$/, ""),
  };
}

export type EmailEnv = {
  appEnv: AppEnv;
  /**
   * Unset until the sender and either the API key or a local inbox are set.
   * Then email is off: nothing is logged or sent. A local inbox wins over
   * Resend, so a dev machine with a real key still never emails anyone.
   */
  sending: { apiKey: string; from: string } | { localInbox: string; from: string } | null;
  /** Where staging sends every email, so a test never reaches anyone else. */
  ownerAlertEmail: string | null;
  /** Checks that a webhook request really came from Resend. */
  webhookSecret: string | null;
};

const emailAddress = z.email({ error: "must be an email address" });

// `Name <address>` or a bare address, on one line, so it can't add headers.
const sender = z.string().refine((value) => {
  if (/[\r\n]/.test(value)) return false;
  const named = /^[^<>"]+ <([^<>\s]+)>$/.exec(value);
  return emailAddress.safeParse(named ? named[1] : value).success;
}, "must be an address, like Youth <hello@mail.example.com>");

// Only this computer: a local inbox is a dev tool, and an address anywhere
// else would send real email around Resend's suppression and logs.
const loopback = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/*$/;

const emailSchema = z.object({
  RESEND_API_KEY: blankAsMissing
    .pipe(z.string().startsWith("re_", "must be a Resend API key (re_...)").optional())
    .optional(),
  EMAIL_FROM: blankAsMissing.pipe(sender.optional()).optional(),
  OWNER_ALERT_EMAIL: blankAsMissing.pipe(emailAddress.toLowerCase().optional()).optional(),
  RESEND_WEBHOOK_SECRET: blankAsMissing
    .pipe(z.string().startsWith("whsec_", "must be a Resend signing secret (whsec_...)").optional())
    .optional(),
  /** Mailpit from the local Supabase stack, like http://127.0.0.1:54324. Local development only. */
  EMAIL_LOCAL_INBOX: blankAsMissing
    .pipe(
      z.string().regex(loopback, "must be an http address on this computer, like http://127.0.0.1:54324").optional(),
    )
    .optional(),
});

/**
 * The email settings, naming any bad one in the error. They're server-only:
 * nothing here may ever be a NEXT_PUBLIC_ variable.
 */
export function readEmailEnv(source: Record<string, string | undefined> = process.env): EmailEnv {
  const result = emailSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Invalid environment variables: ${problems.join("; ")}`);
  }
  const { RESEND_API_KEY, EMAIL_FROM, OWNER_ALERT_EMAIL, RESEND_WEBHOOK_SECRET, EMAIL_LOCAL_INBOX } = result.data;
  let sending: EmailEnv["sending"] = null;
  if (EMAIL_FROM && EMAIL_LOCAL_INBOX) {
    sending = { localInbox: EMAIL_LOCAL_INBOX.replace(/\/+$/, ""), from: EMAIL_FROM };
  } else if (EMAIL_FROM && RESEND_API_KEY) {
    sending = { apiKey: RESEND_API_KEY, from: EMAIL_FROM };
  }
  return {
    appEnv: readPortalEnv(source).appEnv,
    sending,
    ownerAlertEmail: OWNER_ALERT_EMAIL ?? null,
    webhookSecret: RESEND_WEBHOOK_SECRET ?? null,
  };
}

/** Thrown by a write on staging. Its message is safe to show. */
export class ReadOnlyError extends Error {
  constructor() {
    super("This is the staging copy of the portal, so it can't save changes. Use the real portal to make them.");
    this.name = "ReadOnlyError";
  }
}

/** Stops a server write on staging. Call it first in every server action that changes data. */
export function assertWritable(source: Record<string, string | undefined> = process.env): void {
  if (readPortalEnv(source).appEnv === "staging") throw new ReadOnlyError();
}
