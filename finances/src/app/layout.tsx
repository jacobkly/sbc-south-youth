import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SBC South Youth Finances",
  description: "Reimbursement tracking for SBC South Youth.",
  // Private app: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
