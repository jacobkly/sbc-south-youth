import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { site } from "@/content/site";
import "./globals.css";

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

const description =
  "Youth night every Friday at 7:30 PM for high school and college students at Seattle Bethany Church South in Maple Valley, WA.";

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

export const viewport: Viewport = {
  // Lets the page run under the iPhone notch and home indicator; the page pads with safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${bricolage.variable}`}>
      <body className="bg-bg font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
