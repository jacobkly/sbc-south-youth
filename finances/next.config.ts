import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the home network load the dev server by the PC's LAN IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Keeps the dev badge off the bottom tab bar.
  devIndicators: { position: "top-right" },
};

export default nextConfig;
