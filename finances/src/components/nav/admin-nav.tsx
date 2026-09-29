import type { NavUser } from "@/components/nav/nav-items";
import { Rail } from "@/components/nav/rail";
import { Sidebar } from "@/components/nav/sidebar";
import { TabBar } from "@/components/nav/tab-bar";

/**
 * All three, with CSS showing one: the floating tab bar on phones and upright
 * tablets, the rail on narrow PC windows, and the sidebar on wide screens.
 */
export function AdminNav(user: NavUser) {
  return (
    <>
      <TabBar {...user} />
      <Rail {...user} />
      <Sidebar {...user} />
    </>
  );
}
