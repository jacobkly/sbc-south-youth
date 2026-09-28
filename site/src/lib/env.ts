import { z } from "zod";

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
        .regex(/^\$[A-Za-z0-9_]{1,20}$/, "must be a $ followed by up to 20 letters or numbers")
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
