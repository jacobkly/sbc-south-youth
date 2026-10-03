import { z } from "zod";
import { bandChoices, roleChoices } from "@/content/forms";
import { serveAreas } from "@/content/serve-areas";

/**
 * What only some forms ask, as a message saves it in `details`: who's
 * writing on Contact, school on Join, and the ways to serve on Serve.
 */
export const messageAnswers = z.object({
  role: z.string().optional(),
  band: z.string().optional(),
  areas: z.array(z.string()).optional(),
});

export type MessageAnswers = z.infer<typeof messageAnswers>;

/** A message's saved answers, keeping only the ones that read as answers. */
export function readAnswers(details: unknown): MessageAnswers {
  if (typeof details !== "object" || details === null || Array.isArray(details)) return {};
  const answers: MessageAnswers = {};
  for (const key of ["role", "band", "areas"] as const) {
    const field = messageAnswers.shape[key].safeParse((details as Record<string, unknown>)[key]);
    if (field.success && field.data !== undefined) Object.assign(answers, { [key]: field.data });
  }
  return answers;
}

/** A choice as the form showed it, or as saved if the form no longer has it. */
function labelOf(choices: readonly { value: string; label: string }[], value: string): string {
  return choices.find((choice) => choice.value === value)?.label ?? value;
}

/** A message's answers, labeled as the form showed them, for its emails and the portal. */
export function answersOf(answers: MessageAnswers): [label: string, value: string][] {
  const shown: [string, string][] = [];
  if (answers.role) shown.push(["Who", labelOf(roleChoices, answers.role)]);
  if (answers.band) shown.push(["School", labelOf(bandChoices, answers.band)]);
  if (answers.areas) {
    const titles = answers.areas.map((id) => serveAreas.find((area) => area.id === id)?.title ?? id);
    shown.push(["Serve in", titles.join(", ")]);
  }
  return shown;
}
