"use server";

import { refresh } from "next/cache";
import { formatWeekdayDate, todayInLA } from "@/lib/dates";
import { requireRole } from "@/lib/portal/auth/require-role";
import { actionError } from "@/lib/portal/errors";
import { createClient } from "@/lib/supabase/server";
import { planSave, savedMessage, type HeadcountErrors, type HeadcountValues } from "./headcount";
import { loadHeadcount } from "./queries";

/**
 * Headcount changes run as the signed-in person, so RLS, the column grants,
 * and the guard_headcount trigger check each one again, and log_activity
 * records it.
 */

export type SaveResult =
  | { status: "invalid"; errors: HeadcountErrors }
  | { status: "failed"; message: string }
  | { status: "done"; message: string };

export type RemoveResult = { status: "failed"; message: string } | { status: "done"; message: string };

const REFUSAL = "Only someone with Attendance can change headcounts.";
const GONE = "That night's count isn't here anymore. Someone may have just removed it.";
const FALLBACK = "Couldn't save the count. Check your connection and try again.";

/** What the database says about the night itself: one that already has a count, or one in the future. */
const NIGHT_CODES = new Set(["23505", "22023"]);

function failed(message: string): { status: "failed"; message: string } {
  return { status: "failed", message };
}

/** Saves the form: a new night's count when `id` is null, or a fix to one. */
export async function saveHeadcount(id: string | null, values: HeadcountValues): Promise<SaveResult> {
  const usher = await requireRole("attendance", REFUSAL);
  if ("refused" in usher) return failed(usher.refused);

  const existing = id === null ? null : await loadHeadcount(id);
  if (id !== null && !existing) {
    refresh();
    return failed(GONE);
  }

  const today = todayInLA();
  const plan = planSave(values, existing, today);
  if (plan.kind === "invalid") return { status: "invalid", errors: plan.errors };
  if (plan.kind === "same") return { status: "done", message: "Nothing to change." };

  const table = (await createClient()).from("headcounts");
  const { data, error } = existing
    ? await table.update(plan.row).eq("id", existing.id).select("id").maybeSingle()
    : await table.insert(plan.row).select("id").single();
  if (error) {
    const message = await actionError("Save a headcount", error, FALLBACK);
    if (error.code && NIGHT_CODES.has(error.code) && message !== FALLBACK) {
      return { status: "invalid", errors: { night: message } };
    }
    return failed(message);
  }

  refresh();
  if (!data) return failed(GONE);
  return { status: "done", message: savedMessage(plan.row, existing, today) };
}

/** Removes a night's count, for one entered by mistake. Activity keeps what it was. */
export async function removeHeadcount(id: string): Promise<RemoveResult> {
  const usher = await requireRole("attendance", REFUSAL);
  if ("refused" in usher) return failed(usher.refused);

  const existing = await loadHeadcount(id);
  if (!existing) {
    refresh();
    return { status: "done", message: "That count was already removed." };
  }

  const { error } = await (await createClient()).from("headcounts").delete().eq("id", existing.id);
  if (error) {
    const fallback = "Couldn't remove the count. Check your connection and try again.";
    return failed(await actionError("Remove a headcount", error, fallback));
  }

  refresh();
  return { status: "done", message: `Removed the count for ${formatWeekdayDate(existing.night, todayInLA())}.` };
}
