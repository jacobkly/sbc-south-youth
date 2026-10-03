import type { Metadata, Viewport } from "next";
import { SiteDocument, siteViewport } from "@/components/site/site-document";

/**
 * The portal's draft preview gets the public site's document and styles,
 * not the portal's, so a draft looks the way it will on the site.
 */

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };
export const viewport: Viewport = siteViewport;

export default function PreviewLayout({ children }: LayoutProps<"/">) {
  return <SiteDocument>{children}</SiteDocument>;
}
