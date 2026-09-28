import type { NextConfig } from "next";
import { gateRewrites, isGated } from "./src/lib/launch-gate";

const gated = isGated(process.env);

const nextConfig: NextConfig = {
  // Lets a phone on the home network load the dev server by the PC's LAN IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // The dev badge covers page content at phone width.
  devIndicators: false,
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
