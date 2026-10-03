import type { Metadata, Viewport } from "next";
import "./portal.css";
import { Geist } from "next/font/google";
import { ThemeScript } from "@/components/portal/theme-script";
import { site } from "@/content/site";
import { PORTAL_NAME, PORTAL_SHORT_NAME } from "@/lib/portal/install";
import { THEME_CONFIG } from "@/lib/portal/theme";
import { cn } from "@/lib/portal/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

// The site's logo, the same link preview the coming-soon page uses.
const shareImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "SBC South Youth logo" };

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: PORTAL_NAME,
    template: `%s · ${PORTAL_NAME}`,
  },
  applicationName: PORTAL_NAME,
  // Added to an iPhone's home screen, it opens full screen under this name,
  // with no Safari buttons, so every screen needs its own way back. The
  // status bar takes the theme-color. The manifest and icons on the portal
  // host are its own (see lib/portal/install.ts).
  appleWebApp: { title: PORTAL_SHORT_NAME, capable: true, statusBarStyle: "default" },
  // Private app: keep it out of search engines.
  robots: { index: false, follow: false },
  openGraph: { siteName: PORTAL_NAME, type: "website", images: [shareImage] },
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
