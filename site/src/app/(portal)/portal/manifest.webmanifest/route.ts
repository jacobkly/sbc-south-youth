import { portalManifest } from "@/lib/portal/install";

// The portal host's home screen app, in place of the public site's. Made when the site builds.
export function GET() {
  return Response.json(portalManifest(), { headers: { "Content-Type": "application/manifest+json" } });
}
