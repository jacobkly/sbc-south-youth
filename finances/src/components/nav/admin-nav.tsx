import { Sidebar } from "@/components/nav/sidebar";
import { TabBar } from "@/components/nav/tab-bar";
import type { Enums } from "@/lib/database.types";

/** Floating tab bar on phones and tablets, sidebar on PCs. */
export function AdminNav({ role, name }: { role: Enums<"user_role">; name: string }) {
  return (
    <>
      <TabBar role={role} name={name} />
      <Sidebar role={role} name={name} />
    </>
  );
}
