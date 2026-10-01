import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NO_PAGE_PATH } from "@/lib/host";

// The page itself calls notFound(). This only names the tab.
export const metadata: Metadata = { title: "Page not found" };

/**
 * Builds the path the portal's rewrites send hidden URLs to. Having one
 * built path also makes Next render every other unknown path on request,
 * like an unknown event, instead of serving a shell that's already sent
 * a 200.
 */
export function generateStaticParams() {
  return [{ missing: [NO_PAGE_PATH.slice(1)] }];
}

/**
 * Every path here is a 404. Letting it block, instead of streaming a
 * loading shell, means it gets a real 404 status.
 */
export const instant = false;

// Unknown paths on the portal host get the portal's 404, not the public site's.
export default async function MissingPortalPage({ params }: PageProps<"/portal/[...missing]">) {
  // Reading the path keeps the build from saving the 404 as the shell.
  await params;
  notFound();
}
