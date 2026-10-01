import type { Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import "@/app/globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// The optical size axis gives big headlines their tighter display cut.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const siteViewport: Viewport = {
  // Lets the page run under the iPhone notch and home indicator; the page pads with safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
  ],
  colorScheme: "dark light",
};

/** The public site's `<html>` and `<body>`, for its root layout and the 404 for unknown URLs. */
export function SiteDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${bricolage.variable}`}>
      <body className="bg-bg font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
