/**
 * Site-wide facts shown in the footer and nav. Everything marked
 * TODO(leadership) is a placeholder until leadership confirms it.
 */

export type SocialKind = "instagram";

export type SocialLink = { kind: SocialKind; label: string; href: string };

export const site = {
  name: "SBC South Youth",
  url: "https://sbcsouthyouth.com",
  tagline: "High school and college students, together every Friday night at Seattle Bethany Church South.",

  /** The building youth night is in. */
  campus: "Seattle Bethany Church South",
  address: {
    street: "23855 SE 216th St",
    city: "Maple Valley",
    region: "WA",
    postalCode: "98038",
  },

  // TODO(leadership): the youth inbox, once email routing is set up.
  email: "hello@example.org",

  /** The church the youth group is part of. */
  church: { name: "Seattle Bethany Church", href: "https://sbchurch.net/" },

  socials: [
    { kind: "instagram", label: "Instagram", href: "https://www.instagram.com/sbc_south_youth/" },
  ] satisfies SocialLink[],
};

export function formatAddress(address = site.address): string {
  return `${address.street}, ${address.city}, ${address.region} ${address.postalCode}`;
}
