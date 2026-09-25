import { z } from "zod";

/** Trims the value and stores a blank as null, so optional columns never hold "". */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);
}

// Limits match the payees table checks.
export const payeeSchema = z.object({
  full_name: z.string().trim().min(1, "Enter a name.").max(100, "Keep the name to 100 characters or fewer."),
  email: z
    .string()
    .trim()
    .max(254, "That email is too long.")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email, or leave it blank.")
    .transform((value) => value || null),
  payment_handle: optionalText(100, "Keep the payment handle to 100 characters or fewer."),
  notes: optionalText(1000, "Keep notes to 1,000 characters or fewer."),
});

export type PayeeFormValues = z.input<typeof payeeSchema>;
export type PayeeInput = z.output<typeof payeeSchema>;
export type PayeeFieldErrors = Partial<Record<keyof PayeeFormValues, string>>;

/** The first message for each field, ready to show next to it. */
export function payeeFieldErrors(error: z.ZodError<PayeeInput>): PayeeFieldErrors {
  const { fieldErrors } = z.flattenError(error);
  const result: PayeeFieldErrors = {};
  for (const key of Object.keys(fieldErrors) as (keyof PayeeFormValues)[]) {
    const first = fieldErrors[key]?.[0];
    if (first) result[key] = first;
  }
  return result;
}

/** Postgres unique violation, raised by the case-insensitive email index. */
export const DUPLICATE_EMAIL_CODE = "23505";

export const DUPLICATE_EMAIL_MESSAGE = "Another payee already uses this email.";

/** A plain message for a failed payee write. Raw database errors never reach the screen. */
export function payeeSaveErrorMessage(error: { code?: string } | null): string {
  if (error?.code === DUPLICATE_EMAIL_CODE) return DUPLICATE_EMAIL_MESSAGE;
  if (error?.code === "42501" || error?.code === "PGRST116") return "You don't have permission to change payees.";
  return "Couldn't save the payee. Check your connection and try again.";
}
