/**
 * Site-wide facts shown in the footer and nav. Everything marked
 * TODO(leadership) is a placeholder until leadership confirms it.
 */

export type SocialKind = "instagram" | "tiktok" | "youtube";

export type SocialLink = { kind: SocialKind; label: string; href: string };

export const site = {
  name: "SBC South Youth",
  url: "https://sbcsouthyouth.com",
  tagline: "Youth nights, events, and a place to belong for high school and college students.",

  // TODO(leadership): the real street address.
  address: {
    street: "123 Example Street",
    city: "Anytown",
    region: "CA",
    postalCode: "00000",
  },

  // TODO(leadership): the youth inbox, once email routing is set up.
  email: "hello@example.org",

  // TODO(leadership): the main church website.
  church: { name: "SBC South", href: "https://example.org" },

  // TODO(leadership): our real accounts.
  socials: [
    { kind: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
    { kind: "tiktok", label: "TikTok", href: "https://www.tiktok.com/" },
    { kind: "youtube", label: "YouTube", href: "https://www.youtube.com/" },
  ] satisfies SocialLink[],
};

export function formatAddress(address = site.address): string {
  return `${address.street}, ${address.city}, ${address.region} ${address.postalCode}`;
}
