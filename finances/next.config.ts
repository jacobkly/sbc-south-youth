import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the home network load the dev server by the PC's LAN IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // The dev badge covers the bottom tab bar or header buttons at phone width.
  devIndicators: false,
};

export default nextConfig;
