import type { Metadata, Viewport } from "next";
import { site } from "@/content/site";

// The site's logo, the same link preview the coming-soon page uses.
const shareImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "SBC South Youth logo" };

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "SBC South Youth Portal",
    template: "%s · SBC South Youth Portal",
  },
  applicationName: "SBC South Youth Portal",
  // Private app: keep it out of search engines.
  robots: { index: false, follow: false },
  openGraph: { siteName: "SBC South Youth Portal", type: "website", images: [shareImage] },
  twitter: { card: "summary_large_image", images: [shareImage] },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

// The leader portal's root layout, served on the portal host only. The public site has its own in (public).
export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
