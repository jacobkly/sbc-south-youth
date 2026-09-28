export type NavTarget = {
  href: string;
  /** Other sections that light up this item, like event pages for This Week. */
  also?: readonly string[];
};

function inSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

/** Whether a nav item is the current page or the section it's in. */
export function isActive(pathname: string, target: NavTarget): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (target.href === "/") return path === "/";
  return [target.href, ...(target.also ?? [])].some((section) => inSection(path, section));
}
