import { readPortalEnv } from "@/lib/env";
import { publicSiteUrl } from "@/lib/host";
import { allowedFor, DASHBOARD, MAIN_ITEMS } from "./nav-items";
import { canUseFinances, canUsePortal, hasRole, type AppRole } from "./roles";

/**
 * The places someone can go once signed in: the two apps their roles open,
 * and the public site, which anyone can see. The "Where to?" page lists
 * them, and the app switcher in each app's navigation moves between them.
 */
export type AppKey = "portal" | "finances" | "site";

export type Destination = { key: AppKey; name: string; description: string; href: string };

type Person = { is_active: boolean; roles: readonly AppRole[] };

/** Each place's address. The app someone is in links to its own home instead. */
export type DestinationUrls = { portalUrl: string; financesUrl: string; siteUrl: string };

/** Each place's address from the portal's settings. On the server only. */
export function destinationUrls(): DestinationUrls {
  const { portalUrl, financesUrl } = readPortalEnv();
  return { portalUrl, financesUrl, siteUrl: publicSiteUrl(portalUrl) };
}

/** "Posts, photos, and activity", from the labels in order. */
function listOf(labels: string[]): string {
  const words = labels.map((label, index) => (index === 0 ? label : label.toLowerCase()));
  if (words.length <= 2) return words.join(" and ");
  return `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;
}

/** The host alone, like sbcsouthyouth.com. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Where this person can go, in the order the switcher shows them. Showing a
 * place is only a convenience: each app checks the roles again, and RLS
 * guards the data.
 */
export function destinationsFor(person: Person, urls: DestinationUrls, current?: AppKey): Destination[] {
  const href = (key: AppKey, url: string) => (key === current ? "/" : url);
  const destinations: Destination[] = [];

  if (canUsePortal(person)) {
    const sections = MAIN_ITEMS.filter((item) => item !== DASHBOARD).filter(allowedFor(person.roles));
    destinations.push({
      key: "portal",
      name: "Portal",
      description: listOf(sections.map((item) => item.label)),
      href: href("portal", urls.portalUrl),
    });
  }

  if (person.is_active && canUseFinances(person.roles)) {
    destinations.push({
      key: "finances",
      name: "Finances",
      description: hasRole(person.roles, "finance_viewer")
        ? "Requests, payees, and reports"
        : "Your reimbursement requests",
      href: href("finances", urls.financesUrl),
    });
  }

  destinations.push({
    key: "site",
    name: "Main site",
    description: `${hostOf(urls.siteUrl)}, as visitors see it`,
    href: urls.siteUrl,
  });
  return destinations;
}

/**
 * The one app this person signs in to, which the "Where to?" page skips
 * straight to. With both, or neither, it's null. The public site doesn't
 * count, since nobody needs to sign in to see it.
 */
export function onlyApp(destinations: readonly Destination[]): Destination | null {
  const apps = destinations.filter((destination) => destination.key !== "site");
  return apps.length === 1 ? apps[0] : null;
}
