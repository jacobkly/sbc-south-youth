"use server";

import { looksAutomated } from "./guard";
import { checkMessage, type FieldErrors, messageKinds, type MessageKind, readMessageInput } from "./schemas";

export type SubmitResult =
  | { status: "invalid"; errors: FieldErrors }
  | { status: "sent"; firstName: string }
  | { status: "failed"; message: string };

/**
 * Sends a message from one of the forms. Anyone can call this, so it
 * checks everything again instead of trusting the page. A bot gets the
 * same "sent" a person does, so it can't tell it was caught.
 */
export async function submitMessage(kind: MessageKind, data: FormData): Promise<SubmitResult> {
  if (!messageKinds.includes(kind)) return { status: "failed", message: "That form doesn't exist." };

  const result = checkMessage(kind, readMessageInput(data));
  if (!result.ok) return { status: "invalid", errors: result.errors };

  const firstName = result.message.name.split(/\s+/)[0];
  if (looksAutomated(data)) return { status: "sent", firstName };

  // TODO(wire-up): check Turnstile, apply the rate limit, save the message
  // in site.messages, and email the youth inbox. Until then nothing is
  // kept or sent, so the forms must be wired up before SITE_LIVE is set.
  return { status: "sent", firstName };
}
