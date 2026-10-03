"use server";

import { refresh, updateTag } from "next/cache";
import { laDateOf } from "@/lib/dates";
import { requireRole } from "@/lib/portal/auth/require-role";
import { friendlyError } from "@/lib/portal/people/invite";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, EventState } from "./list";
import { loadEvent, takenSlugs } from "./queries";
import { planCancel, planRemove, planRestore, planSave, savedMessage } from "./save";
import type { EventErrors, EventValues } from "./schema";
import { slugify, uniqueSlug } from "./slug";

/**
 * Every event change runs as the signed-in site editor, so RLS, the column
 * grants, and the triggers check it again. Each one refreshes the public
 * site's cached events, so the site and the calendar feed show the change
 * on their next load.
 */

export type SaveResult =
  | { status: "invalid"; errors: EventErrors }
  | { status: "failed"; message: string }
  | { status: "done"; id: string; slug: string; state: EventState; message: string };

export type EventActionResult = { status: "failed"; message: string } | { status: "done"; message: string };

const REFUSAL = "Only site editors can change events.";
const GONE = "That event isn't here anymore. Go back to Events and try again.";
/** Postgres's code for a unique value that's already taken. */
const TAKEN = "23505";
/** Two editors saving events with the same title at once is the only way a free slug gets taken. */
const SLUG_TRIES = 3;

function failed(message: string): { status: "failed"; message: string } {
  return { status: "failed", message };
}

/**
 * Saves the editor: a new event when `id` is null, or changes to one.
 * Publish puts it on the site and in calendars; draft keeps it in the portal.
 */
export async function saveEvent(
  id: string | null,
  values: EventValues,
  intent: "publish" | "draft",
): Promise<SaveResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);
  if (intent !== "publish" && intent !== "draft") return failed("Pick Publish or Save draft.");

  const existing = id === null ? null : await loadEvent(id);
  if (id !== null && !existing) return failed(GONE);

  const now = new Date();
  const plan = planSave(values, intent, existing, now);
  if (plan.kind === "invalid") return { status: "invalid", errors: plan.errors };
  if (plan.kind === "refuse") return failed(plan.message);

  const fallback = "Couldn't save the event. Check your connection and try again.";
  const table = await events();
  const exceptId = existing?.id ?? null;
  let saved;
  for (let tries = 1; ; tries++) {
    // A published event keeps its slug, so its page and calendar entry stay put.
    const slug = plan.newSlug ? await pickSlug(plan.row.title, plan.row.starts_at, exceptId) : null;
    saved = existing
      ? await table.update(slug ? { ...plan.row, slug } : plan.row).eq("id", existing.id).select("id, slug").single()
      : await table.insert({ ...plan.row, slug: slug ?? slugify(plan.row.title) }).select("id, slug").single();
    if (saved.error?.code !== TAKEN || !plan.newSlug || tries === SLUG_TRIES) break;
  }
  if (saved.error) return failed(friendlyError(saved.error, fallback));

  updateTag("events");
  const publishing = existing?.status !== "published";
  const { id: savedId, slug } = saved.data;
  return { status: "done", id: savedId, slug, state: plan.state, message: savedMessage(plan.row, now, publishing) };
}

/**
 * A slug from the title that no other event has. The prefix is short
 * enough to find every slug the suffixed ones could run into, since a
 * long title is cut to fit the date.
 */
async function pickSlug(title: string, startsAt: string, exceptId: string | null): Promise<string> {
  const base = slugify(title);
  return uniqueSlug(base, laDateOf(startsAt), await takenSlugs(base.slice(0, 32), exceptId));
}

/** Calls off an event that went out. It stays on the site with a banner, and calendars show it cancelled. */
export async function cancelEvent(id: string, reason: string): Promise<EventActionResult> {
  return change(id, async (event, now) => {
    const plan = planCancel(event, reason, now);
    if (plan.kind !== "write") return failed(plan.message);
    const { error } = await (await events()).update(plan.row).eq("id", event.id);
    return outcome(error, "Couldn't cancel the event.", "Cancelled. The site and calendars show it called off.");
  });
}

/** Puts a cancelled event back on. */
export async function restoreEvent(id: string): Promise<EventActionResult> {
  return change(id, async (event, now) => {
    const plan = planRestore(event, now);
    if (plan.kind === "refuse") return failed(plan.message);
    const { error } = await (await events()).update(plan.row).eq("id", event.id);
    return outcome(error, "Couldn't put the event back on.", "It's back on, on the site and in calendars.");
  });
}

/**
 * Deletes a draft. The database refuses anything that was ever published.
 * Its page is gone after, so the form moves on to Events instead of refreshing.
 */
export async function deleteEvent(id: string): Promise<EventActionResult> {
  return change(
    id,
    async (event, now) => {
      const plan = planRemove(event, now);
      if (plan.kind === "refuse") return failed(plan.message);
      const { error } = await (await events()).delete().eq("id", event.id);
      return outcome(error, "Couldn't delete the draft.", "Deleted the draft.");
    },
    { refreshPage: false },
  );
}

async function events() {
  return (await createClient()).schema("site").from("events");
}

function outcome(
  error: { code?: string; message: string } | null,
  couldnt: string,
  message: string,
): EventActionResult {
  if (error) return failed(friendlyError(error, `${couldnt} Check your connection and try again.`));
  return { status: "done", message };
}

/**
 * The steps around an event's own action: the role check and a fresh read
 * first, then, once it's written, refreshing the public site and the page.
 */
async function change(
  id: string,
  write: (event: EventRow, now: Date) => Promise<EventActionResult>,
  { refreshPage = true } = {},
): Promise<EventActionResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);
  const event = await loadEvent(id);
  if (!event) return failed(GONE);

  const result = await write(event, new Date());
  if (result.status === "done") {
    updateTag("events");
    if (refreshPage) refresh();
  }
  return result;
}
