import { drawIcon } from "@/lib/portal/icon";
import { isPortalIcon, PORTAL_ICONS } from "@/lib/portal/install";

export function generateStaticParams() {
  return Object.keys(PORTAL_ICONS).map((file) => ({ file }));
}

// The portal host's icons, in place of the public site's. Drawn when the site builds.
export async function GET(_request: Request, { params }: RouteContext<"/portal/icons/[file]">) {
  const { file } = await params;
  if (!isPortalIcon(file)) return new Response("Not found", { status: 404 });
  return drawIcon(PORTAL_ICONS[file]);
}
