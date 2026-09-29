import type { MetadataRoute } from "next";
import { site } from "@/content/site";

/** Lets students add the site to their home screen, where it opens like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The dark theme's page color, for the splash screen and the status bar.
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }],
  };
}
