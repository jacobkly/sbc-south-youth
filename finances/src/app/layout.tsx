import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SBC South Youth Finances",
  description: "Reimbursement tracking for SBC South Youth.",
  // Private app: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Lets the bottom tab bar sit above the iPhone home indicator via safe-area insets.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
