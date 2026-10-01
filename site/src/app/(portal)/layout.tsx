import type { Metadata, Viewport } from "next";
import "./portal.css";
import { Geist } from "next/font/google";
import { ThemeScript } from "@/components/portal/theme-script";
import { site } from "@/content/site";
import { THEME_CONFIG } from "@/lib/portal/theme";
import { cn } from "@/lib/portal/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

// The site's logo, the same link preview the coming-soon page uses.
const shareImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "SBC South Youth logo" };

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "SBC South Youth Portal",
    template: "%s · SBC South Youth Portal",
  },
  applicationName: "SBC South Youth Portal",
  // Home screen name on iPhone, which would otherwise be the page title.
  // `capable: false` keeps it opening in Safari.
  appleWebApp: { title: "SBC South Youth Portal", capable: false },
  // Private app: keep it out of search engines.
  robots: { index: false, follow: false },
  openGraph: { siteName: "SBC South Youth Portal", type: "website", images: [shareImage] },
  twitter: { card: "summary_large_image", images: [shareImage] },
};

export const viewport: Viewport = {
  // Lets the bottom tab bar sit above the iPhone home indicator via safe-area insets.
  viewportFit: "cover",
  // The theme script changes it to match the saved theme.
  themeColor: THEME_CONFIG.colors.light,
};

// The leader portal's root layout, served on the portal host only. It looks
// like finances. The public site has its own in (public).
export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script adds its classes before React hydrates.
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
