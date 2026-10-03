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

// The logo's height on an icon. Small enough that Android's round crop
// keeps all of it, the way the portal's header shows it on its tile.
const LOGO_SHARE = 0.56;

/** The logo's size, centered on an icon `size` pixels square. */
export function logoSize(size: number): { width: number; height: number } {
  const height = Math.round(size * LOGO_SHARE);
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
