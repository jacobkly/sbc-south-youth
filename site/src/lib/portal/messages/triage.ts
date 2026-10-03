import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { isClosed, STATUS_LABELS, type MessageRow, type MessageStatus, type ServeOutcome } from "./list";

/**
 * Triage: a message's status, its serve outcome, who has it, and a note
 * for other leaders. site.triage_message() checks each change again and
 * logs everything but the note.
 */

/** What changes, as site.triage_message() takes it. Only the keys that change. */
export type TriageChanges = {
  status?: MessageStatus;
  outcome?: ServeOutcome | null;
  assigned_to?: string | null;
  internal_note?: string | null;
};

/** The longest note the database takes. */
export const NOTE_LIMIT = 2000;

const NOT_ON_LIST = "Choose a status, outcome, or leader from the list.";

/** What a form may ask for. Anything else, like the sender's own words, never changes. */
const asked = z.strictObject({
  status: z.enum(Constants.site.Enums.message_status).optional(),
  outcome: z.enum(Constants.site.Enums.serve_outcome).nullable().optional(),
  assigned_to: z.uuid().nullable().optional(),
  internal_note: z.string().nullable().optional(),
});

export type TriagePlan =
  | { kind: "save"; changes: TriageChanges }
  | { kind: "same" }
  | { kind: "refuse"; message: string };

function refuse(message: string): TriagePlan {
  return { kind: "refuse", message };
}

/**
 * What to send for a form's changes: only what differs from the message
 * as it is, with the note trimmed and a blank one cleared.
 */
export function planTriage(message: MessageRow, input: unknown): TriagePlan {
  const parsed = asked.safeParse(input);
  if (!parsed.success) return refuse(NOT_ON_LIST);
  const { status, outcome, assigned_to, internal_note } = parsed.data;
  const changes: TriageChanges = {};

  if (status !== undefined && status !== message.status) changes.status = status;
  if (outcome !== undefined && outcome !== message.outcome) {
    if (outcome !== null && message.kind !== "serve") return refuse("Only a serve message has an outcome.");
    changes.outcome = outcome;
  }
  if (assigned_to !== undefined) {
    const leader = assigned_to?.toLowerCase() ?? null;
    if (leader !== message.assigned_to) changes.assigned_to = leader;
  }
  if (internal_note !== undefined) {
    const note = internal_note?.trim() || null;
    if (note && [...note].length > NOTE_LIMIT) return refuse("Keep the note under 2,000 characters.");
    if (note !== message.internal_note) changes.internal_note = note;
  }

  return Object.keys(changes).length === 0 ? { kind: "same" } : { kind: "save", changes };
}

/**
 * The message once the changes land, the way the database records them,
 * so the screen can show it before the save finishes. Closing it records
 * who and when, and opening it again clears them.
 */
export function applyTriage(message: MessageRow, changes: TriageChanges, me: string, now: Date): MessageRow {
  const next: MessageRow = { ...message, ...changes };
  if (changes.status === undefined) return next;
  if (!isClosed(changes.status)) return { ...next, handled_by: null, handled_at: null };
  if (changes.status === message.status) return next;
  return { ...next, handled_by: me, handled_at: now.toISOString() };
}

const STATUS_DONE: Record<MessageStatus, string> = {
  new: `Moved back to ${STATUS_LABELS.new}.`,
  in_progress: `Moved to ${STATUS_LABELS.in_progress}.`,
  handled: "Marked handled.",
  spam: "Marked as spam.",
};

/** What a saved change says it did, like "Marked handled." or "Assigned to you." */
export function triagedMessage(changes: TriageChanges, names: ReadonlyMap<string, string>, me: string): string {
  const said: string[] = [];
  if (changes.status) said.push(STATUS_DONE[changes.status]);
  if (changes.assigned_to === null) said.push("Nobody has it now.");
  else if (changes.assigned_to === me) said.push("Assigned to you.");
  else if (changes.assigned_to) said.push(`Assigned to ${names.get(changes.assigned_to) ?? "another leader"}.`);
  if (changes.outcome !== undefined) said.push(changes.outcome ? "Saved the outcome." : "Cleared the outcome.");
  if (changes.internal_note !== undefined) said.push(changes.internal_note ? "Saved the note." : "Cleared the note.");
  return said.join(" ") || "Saved.";
}
