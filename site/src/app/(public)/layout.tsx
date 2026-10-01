import type { Metadata, Viewport } from "next";
import { SiteDocument, siteViewport } from "@/components/site/site-document";
import { site } from "@/content/site";

const description =
  "Friday nights at 7:30 PM for high school and college age, at Seattle Bethany Church South in Maple Valley, WA.";

export const metadata: Metadata = {
  // Makes the link preview image URL absolute. Vercel previews use their own URL instead.
  metadataBase: new URL(site.url),
  title: { default: "SBC South Youth", template: "%s · SBC South Youth" },
  description,
  applicationName: "SBC South Youth",
  openGraph: {
    title: "SBC South Youth",
    description,
    siteName: "SBC South Youth",
    url: "/",
    locale: "en_US",
    type: "website",
  },
  // Big image previews where people share links. The title and image come from openGraph.
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = siteViewport;

// The public site's root layout. The leader portal has its own in (portal).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return <SiteDocument>{children}</SiteDocument>;
}
