import type { NextConfig } from "next";
import { portalRewrites, siteHeaders } from "./src/lib/host";
import { gateRewrites, isGated } from "./src/lib/launch-gate";

const gated = isGated(process.env);

const nextConfig: NextConfig = {
  // Lets a phone on the home network load the dev server by the PC's LAN IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // The dev badge covers page content at phone width.
  devIndicators: false,
  // The repo root has its own lockfile. This app only resolves files from
  // its own folder.
  turbopack: { root: __dirname },
  // Only the site's own files go through next/image. Photos come straight
  // from Supabase Storage in the two sizes the portal made, so no other
  // host is allowed here.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  cacheComponents: true,
  experimental: {
    // The public site and the portal each have a root layout, so unknown URLs need their own 404 page.
    globalNotFound: true,
  },
  cacheLife: {
    // Time-sensitive sections (Next Up, This Week) refresh every 5 minutes.
    feed: { stale: 300, revalidate: 300, expire: 3600 },
    // The calendar feed, which calendar apps check twice a day.
    calendar: { stale: 900, revalidate: 900, expire: 3600 },
  },
  async rewrites() {
    return { beforeFiles: [...portalRewrites(), ...gateRewrites(gated)], afterFiles: [], fallback: [] };
  },
  async headers() {
    const mode = { dev: process.env.NODE_ENV === "development", https: process.env.VERCEL === "1" };
    return siteHeaders(mode, process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
};

export default nextConfig;
