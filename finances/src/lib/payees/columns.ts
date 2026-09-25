import type { Tables } from "@/lib/database.types";

/** The payee columns the app reads. Keep in sync with PayeeRow. */
export const PAYEE_COLUMNS = "id, full_name, email, payment_handle, notes, is_active, user_id";

export type PayeeRow = Pick<
  Tables<"payees">,
  "id" | "full_name" | "email" | "payment_handle" | "notes" | "is_active" | "user_id"
>;
