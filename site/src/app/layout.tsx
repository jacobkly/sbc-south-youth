import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const description = "Youth nights, events, and a place to belong for high school and college students at SBC South.";

export const metadata: Metadata = {
  // Makes the link preview image URL absolute. Vercel previews use their own URL instead.
  metadataBase: new URL("https://sbcsouthyouth.com"),
  title: { default: "SBC South Youth", template: "%s · SBC South Youth" },
  description,
  applicationName: "SBC South Youth",
  openGraph: {
    title: "SBC South Youth",
    description,
    siteName: "SBC South Youth",
    url: "/",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Lets the page run under the iPhone notch and home indicator; the page pads with safe-area insets.
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body className="bg-black font-sans text-white antialiased">{children}</body>
    </html>
  );
}
