"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/portal/auth/require-role";
import { actionError } from "@/lib/portal/errors";
import { createClient } from "@/lib/supabase/server";

export type AllowResult = { status: "failed"; message: string } | { status: "done" };

const REFUSAL = "Only an owner can unblock an address.";
const FALLBACK = "Couldn't unblock it. Check your connection and try again.";

/**
 * Starts sending to a blocked address again, say after someone fixed their
 * inbox. Runs as the owner through email_unsuppress(), which checks again.
 */
export async function allowAddress(id: string): Promise<AllowResult> {
  const owner = await requireRole("owner", REFUSAL);
  if ("refused" in owner) return { status: "failed", message: owner.refused };
  if (!z.uuid().safeParse(id).success) return { status: "failed", message: "That address isn't blocked anymore." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("email_unsuppress", { p_id: id });
  if (error?.code === "P0002") {
    refresh();
    return { status: "failed", message: "That address isn't blocked anymore." };
  }
  if (error) return { status: "failed", message: await actionError("Unblock an address", error, FALLBACK) };

  refresh();
  return { status: "done" };
}
