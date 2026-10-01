import type { Metadata, Viewport } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";
import { SiteDocument, siteViewport } from "@/components/site/site-document";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = {
  title: "Page not found · SBC South Youth",
};

export const viewport: Viewport = siteViewport;

// Any URL no page matches. It skips every layout, so it brings the public site's document and chrome.
export default function GlobalNotFound() {
  return (
    <SiteDocument>
      <SiteShell>
        <NotFoundContent />
      </SiteShell>
    </SiteDocument>
  );
}
