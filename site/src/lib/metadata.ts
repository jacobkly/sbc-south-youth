import type { Metadata } from "next";
import { site } from "@/content/site";

/** Adds the site name, for places that show a title on its own, like a link preview. */
export function fullTitle(title: string): string {
  return `${title} · ${site.name}`;
}

/**
 * A page's tab title, search description, canonical URL, and link
 * preview. A page's `openGraph` replaces the layout's whole, so this
 * repeats every field. The preview image comes from the nearest
 * `opengraph-image` file.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle(title),
      description,
      url: path,
      siteName: site.name,
      locale: "en_US",
      type: "website",
    },
  };
}
