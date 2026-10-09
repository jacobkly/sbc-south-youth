import type { MetadataRoute } from "next";
import { THEME_CONFIG } from "./theme";

/**
 * The portal as a home screen app. On the portal host, the manifest and
 * the icons the root layout links to are the portal's own (see host.ts),
 * so a leader who adds it to their home screen gets "Youth Portal" with
 * its own icon, and it opens full screen without Safari's buttons.
 */

export const PORTAL_NAME = "SBC South Youth Portal";

/** The name under its home screen icon, short enough that iOS shows all of it. */
export const PORTAL_SHORT_NAME = "Youth Portal";

/** Each icon's file and its size in pixels. They're drawn when the site builds. */
export const PORTAL_ICONS = {
  // The browser tab, and Android's home screen.
  "icon.png": 192,
  // The iPhone home screen.
  "apple-icon.png": 180,
  // Android's install screen and splash, whole or cropped to its shape.
  "icon-512.png": 512,
} as const;

export type PortalIcon = keyof typeof PORTAL_ICONS;

export function isPortalIcon(file: string): file is PortalIcon {
  return Object.hasOwn(PORTAL_ICONS, file);
}

/** The size of src/assets/logo.png. */
export const LOGO = { width: 334, height: 363 };

/** The tile behind the logo: black, like finances' and the public site's icons. */
export const ICON_TILE = "#000000";

// The logo's height on each icon. The browser tab and iPhone icons match
// finances' and the public site's, so the apps look the same side by side
// on a home screen. Android may crop the 512 one to a circle, so its logo
// is small enough to stay inside.
const LOGO_SHARE: Record<PortalIcon, number> = {
  "icon.png": 0.8,
  "apple-icon.png": 0.72,
  "icon-512.png": 0.56,
};

/** The logo's size, centered on the icon. */
export function logoSize(file: PortalIcon): { width: number; height: number } {
  const height = Math.round(PORTAL_ICONS[file] * LOGO_SHARE[file]);
  return { width: Math.round((height * LOGO.width) / LOGO.height), height };
}

function icon(file: PortalIcon, purpose?: "maskable") {
  const size = `${PORTAL_ICONS[file]}x${PORTAL_ICONS[file]}`;
  return { src: `/${file}`, sizes: size, type: "image/png", ...(purpose && { purpose }) };
}

export function portalManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PORTAL_NAME,
    short_name: PORTAL_SHORT_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The default light theme. The theme script colors the status bar after that.
    background_color: THEME_CONFIG.colors.light,
    theme_color: THEME_CONFIG.colors.light,
    icons: [icon("icon.png"), icon("icon-512.png"), icon("icon-512.png", "maskable")],
  };
}
