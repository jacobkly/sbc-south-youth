import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { RECEIPTS_BUCKET } from "@/lib/receipts/upload";
import { RETRY_MESSAGE } from "./actions";

const NOT_YOURS = "Only the admin who entered a draft can delete it.";

/** Enough for a full request plus any files left behind by failed uploads. */
const MAX_FILES = 100;

/**
 * Deletes a draft and every file in its storage folder, including any left
 * behind by a failed upload. Files go first, since storage checks each one
 * against its request, and the receipt rows go with the request. Returns a
 * message to show, or null once the draft is gone. `userId` is the signed-in
 * admin, who has to be the one who entered it.
 */
export async function deleteDraft(
  supabase: SupabaseClient<Database>,
  requestId: string,
  userId: string,
): Promise<string | null> {
  // Checked before touching files, which any admin can delete while the request is open.
  const current = await supabase
    .from("reimbursement_requests")
    .select("status, created_by")
    .eq("id", requestId)
    .maybeSingle();
  if (current.error) return RETRY_MESSAGE;
  if (!current.data) return null;
  if (current.data.created_by !== userId) return NOT_YOURS;
  if (current.data.status !== "draft") {
    return "This isn't a draft anymore, so it can't be deleted. Reload to see where it stands.";
  }

  const bucket = supabase.storage.from(RECEIPTS_BUCKET);
  const listed = await bucket.list(requestId, { limit: MAX_FILES });
  if (listed.error) return RETRY_MESSAGE;
  // Folders come back without an id.
  const paths = listed.data.filter((file) => file.id).map((file) => `${requestId}/${file.name}`);

  if (paths.length > 0) {
    const removed = await bucket.remove(paths);
    if (removed.error || removed.data.length < paths.length) return "Couldn't delete its receipts. " + RETRY_MESSAGE;
  }

  const { data, error } = await supabase.from("reimbursement_requests").delete().eq("id", requestId).select("id");
  if (error) return RETRY_MESSAGE;
  if (data.length === 0) return NOT_YOURS;
  return null;
}
