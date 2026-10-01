import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function PortalNotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        <Link href="/">Go to the portal home</Link>
      </p>
    </main>
  );
}
