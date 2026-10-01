import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";

export const metadata: Metadata = { title: "Page not found" };

// For notFound() in a page, which already sits inside the site's layout.
export default function NotFound() {
  return <NotFoundContent />;
}
