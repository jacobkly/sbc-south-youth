import type { NavUser } from "@/components/nav/nav-items";
import { Sidebar } from "@/components/nav/sidebar";
import { TabBar } from "@/components/nav/tab-bar";

/** Floating tab bar on phones and tablets, sidebar on PCs. */
export function AdminNav(user: NavUser) {
  return (
    <>
      <TabBar {...user} />
      <Sidebar {...user} />
    </>
  );
}
