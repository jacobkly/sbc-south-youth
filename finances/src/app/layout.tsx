import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { ThemeScript } from "@/components/theme-script";
import { THEME_CONFIG } from "@/lib/theme";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "SBC South Youth Finances",
    template: "%s · SBC South Youth Finances",
  },
  description: "Reimbursement tracking for SBC South Youth.",
  applicationName: "SBC South Youth Finances",
  // Home screen name on iPhone, which would otherwise be the page title.
  // `capable: false` keeps it opening in Safari.
  appleWebApp: { title: "SBC South Youth Finances", capable: false },
  // Private app: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Lets the bottom tab bar sit above the iPhone home indicator via safe-area insets.
  viewportFit: "cover",
  // The theme script changes it to match the saved theme.
  themeColor: THEME_CONFIG.colors.light,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
