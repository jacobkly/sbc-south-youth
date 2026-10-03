import { Rail } from "@/components/portal/nav/rail";
import { Sidebar } from "@/components/portal/nav/sidebar";
import { TabBar } from "@/components/portal/nav/tab-bar";
import type { NavUser } from "@/lib/portal/nav-items";

/**
 * All three, with CSS showing one: the floating tab bar on phones and upright
 * tablets, the rail on narrow PC windows, and the sidebar on wide screens.
 */
export function PortalNav(user: NavUser) {
  return (
    <>
      <TabBar {...user} />
      <Rail {...user} />
      <Sidebar {...user} />
    </>
  );
}
