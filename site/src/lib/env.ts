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
};

const blankAsMissing = z
  .string()
  .trim()
  .transform((value) => value || undefined);

const portalSchema = z.object({
  APP_ENV: blankAsMissing.pipe(z.enum(["production", "staging"]).optional()).optional(),
  /** Set by Vercel on every build: production, preview, or development. */
  VERCEL_ENV: z.string().optional(),
  FINANCES_URL: blankAsMissing
    .pipe(z.url({ protocol: /^https?$/, error: "must be an http or https address" }).optional())
    .optional(),
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
  const { APP_ENV, VERCEL_ENV, FINANCES_URL } = result.data;
  return {
    appEnv: APP_ENV ?? (VERCEL_ENV === "preview" ? "staging" : "production"),
    financesUrl: (FINANCES_URL ?? "https://finances.sbcsouthyouth.com").replace(/\/+$/, ""),
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
