import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Records a visit, which the database does at most once an hour. The visit
 * that does also accepts a pending invite, so a requester who only ever
 * uses finances shows on the portal's People screen as active, with when
 * they were last seen. It never throws, since it runs after the page is
 * sent.
 */
export async function markSeen(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    const { data: wrote, error } = await supabase.rpc("touch_last_seen");
    if (error) {
      console.error("Couldn't record a visit.", error);
      return;
    }
    if (!wrote) return;
    const { error: acceptError } = await supabase.rpc("accept_invite");
    if (acceptError) console.error("Couldn't accept an invite.", acceptError);
  } catch (error) {
    // A dropped connection throws instead of returning an error.
    console.error("Couldn't record a visit.", error);
  }
}
