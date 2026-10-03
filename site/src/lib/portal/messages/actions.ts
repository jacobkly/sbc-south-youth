"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/portal/auth/require-role";
import { friendlyError } from "@/lib/portal/people/invite";
import { createClient } from "@/lib/supabase/server";
import { loadAssignees, loadMessage } from "./queries";
import { planTriage, triagedMessage } from "./triage";

/**
 * Triage runs as the signed-in person through site.triage_message(),
 * which checks the role and every change again and logs it.
 */

export type TriageResult = { status: "failed"; message: string } | { status: "done"; message: string };

const REFUSAL = "Only someone with Messages can change a message.";
const GONE = "That message isn't here anymore. Go back to Messages and try again.";

function failed(message: string): TriageResult {
  return { status: "failed", message };
}

/** Changes a message's status, outcome, assignment, or note. Only what differs is sent. */
export async function triageMessage(id: string, input: unknown): Promise<TriageResult> {
  const leader = await requireRole("site_messages", REFUSAL);
  if ("refused" in leader) return failed(leader.refused);
  const message = await loadMessage(id);
  if (!message) return failed(GONE);

  const plan = planTriage(message, input);
  if (plan.kind === "refuse") return failed(plan.message);
  if (plan.kind === "same") return { status: "done", message: "Nothing to change." };

  const supabase = await createClient();
  const { error } = await supabase.schema("site").rpc("triage_message", { p_id: message.id, p_changes: plan.changes });
  if (error) return failed(friendlyError(error, "Couldn't save that. Check your connection and try again."));

  const { assigned_to } = plan.changes;
  const names =
    assigned_to && assigned_to !== leader.me.id
      ? new Map((await loadAssignees()).map((person) => [person.id, person.name]))
      : new Map<string, string>();
  refresh();
  return { status: "done", message: triagedMessage(plan.changes, names, leader.me.id) };
}
