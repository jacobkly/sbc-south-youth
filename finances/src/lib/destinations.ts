import { canUseArea } from "@/lib/auth/roles";
import type { Enums } from "@/lib/database.types";
import { readAppsEnv } from "@/lib/env";

type AppRole = Enums<"app_role">;

/**
 * The places someone can go once signed in: the two apps their roles open,
 * and the public site, which anyone can see. The app switcher in the
 * navigation moves between them, like the portal's.
 */
export type AppKey = "portal" | "finances" | "site";

export type Destination = { key: AppKey; name: string; description: string; href: string };

type Person = { is_active: boolean; roles: readonly AppRole[] };

/** The other places' addresses. Finances links to its own home. */
export type DestinationUrls = { portalUrl: string; siteUrl: string };

/** The other places' addresses from this app's settings. On the server only. */
export function destinationUrls(): DestinationUrls {
  const { portalUrl, siteUrl } = readAppsEnv();
  return { portalUrl, siteUrl };
}

/**
 * The portal's sections and who sees each, in the portal's order. Keep them
 * in step with the portal's navigation, which they only describe.
 */
const PORTAL_SECTIONS: { label: string; roles: AppRole[] }[] = [
  { label: "Posts", roles: ["site_editor"] },
  { label: "Photos", roles: ["site_editor"] },
  { label: "Messages", roles: ["site_messages"] },
  { label: "Attendance", roles: ["attendance", "finance_viewer"] },
  { label: "Activity", roles: ["finance_viewer", "site_editor", "site_messages"] },
  { label: "People", roles: ["owner"] },
  { label: "Email", roles: ["owner"] },
];

/** Like has_role() in the database, an owner counts as every role. */
function hasRole(roles: readonly AppRole[], wanted: readonly AppRole[]): boolean {
  return roles.includes("owner") || wanted.some((role) => roles.includes(role));
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
export function destinationsFor(person: Person, urls: DestinationUrls): Destination[] {
  const destinations: Destination[] = [];

  // Requesters only use finances. Everyone else with a role uses the portal.
  const sections = PORTAL_SECTIONS.filter((section) => hasRole(person.roles, section.roles));
  if (person.is_active && sections.length > 0) {
    destinations.push({
      key: "portal",
      name: "Portal",
      description: listOf(sections.map((section) => section.label)),
      href: urls.portalUrl,
    });
  }

  if (canUseArea(person, "account")) {
    destinations.push({
      key: "finances",
      name: "Finances",
      description: canUseArea(person, "team") ? "Requests, payees, and reports" : "Your reimbursement requests",
      href: "/",
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
