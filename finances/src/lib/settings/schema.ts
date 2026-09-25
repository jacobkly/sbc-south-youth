import { z } from "zod";
import type { Tables } from "@/lib/database.types";

export const SETTINGS_COLUMNS = "allow_external_approval, late_submission_days, updated_at";

export type AppSettings = Pick<Tables<"app_settings">, "allow_external_approval" | "late_submission_days" | "updated_at">;

/** The table allows up to 3650, but a year is already far past any real deadline. */
export const MAX_LATE_SUBMISSION_DAYS = 365;

const DAYS_MESSAGE = `Enter a whole number of days from 1 to ${MAX_LATE_SUBMISSION_DAYS}.`;

export const settingsSchema = z.object({
  allow_external_approval: z.boolean(),
  late_submission_days: z
    .string()
    .trim()
    .regex(/^\d+$/, DAYS_MESSAGE)
    .transform(Number)
    .pipe(z.number().min(1, DAYS_MESSAGE).max(MAX_LATE_SUBMISSION_DAYS, DAYS_MESSAGE)),
});

export type SettingsFormValues = z.input<typeof settingsSchema>;

/** The saved settings as form values. */
export function settingsFormValues(settings: AppSettings): SettingsFormValues {
  return {
    allow_external_approval: settings.allow_external_approval,
    late_submission_days: String(settings.late_submission_days),
  };
}

/** A plain message for a failed save. Raw database errors never reach the screen. */
export function settingsSaveErrorMessage(error: { code?: string } | null): string {
  // RLS turns a viewer's update into zero rows, which .single() reports as PGRST116.
  if (error?.code === "42501" || error?.code === "PGRST116") return "Only admins can change settings.";
  return "Couldn't save the settings. Check your connection and try again.";
}
