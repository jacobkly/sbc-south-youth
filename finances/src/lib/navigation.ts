/** A page an in-app back button can return to. */
export type BackTarget = {
  /** How far back it is. More than 1 when this page is in history more than once in a row. */
  steps: number;
  /** Its path and query, e.g. "/admin/reports?period=2026-q3". */
  href: string;
};

const PAGE_LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/requests": "Requests",
  "/admin/requests/new": "New request",
  "/admin/payees": "Payees",
  "/admin/reports": "Reports",
  "/admin/settings": "Settings",
  "/admin/settings/import": "Import",
  "/account": "Account",
};

function isAppPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/account";
}

/** A short name for a page of the app, shown on a back button, e.g. "Dashboard". */
export function pageLabel(pathname: string): string {
  const label = PAGE_LABELS[pathname];
  if (label) return label;
  if (/^\/admin\/requests\/[^/]+$/.test(pathname)) return "Request";
  if (/^\/admin\/payees\/[^/]+$/.test(pathname)) return "Payee";
  return "Back";
}

/**
 * The page before this one in the tab's history, when it's a page of this
 * app. Earlier copies of this same page are skipped, since saving an edit
 * leaves one behind, so back never lands on the page you're already on.
 *
 * `urls` is the tab's history, oldest first, and `index` is where this page is.
 */
export function findBackTarget(urls: readonly (string | null)[], index: number): BackTarget | null {
  const current = urls[index];
  if (current == null) return null;

  for (let at = index - 1; at >= 0; at--) {
    const url = urls[at];
    if (url === current) continue;
    if (url == null) return null;

    const { pathname, search } = new URL(url);
    return isAppPath(pathname) ? { steps: index - at, href: pathname + search } : null;
  }

  return null;
}
