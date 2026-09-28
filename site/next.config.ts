import type { NextConfig } from "next";
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
  images: {
    formats: ["image/avif", "image/webp"],
    // Placeholder photos until the media team's photos arrive. Only this
    // exact query is allowed, so nobody can resize other Unsplash URLs here.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*", search: "?w=1600&q=80&auto=format" },
    ],
  },
  cacheComponents: true,
  cacheLife: {
    // Time-sensitive sections (Next Up, This Week) refresh every 5 minutes.
    feed: { stale: 300, revalidate: 300, expire: 3600 },
  },
  async rewrites() {
    return { beforeFiles: gateRewrites(gated), afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
