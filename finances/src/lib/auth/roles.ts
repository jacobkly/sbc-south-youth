import type { Enums } from "@/lib/database.types";

export const ROLE_LABELS: Record<Enums<"user_role">, string> = { admin: "Admin", viewer: "Viewer", member: "Member" };
