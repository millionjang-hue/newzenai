import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone/server.js - a self-contained server for Docker and
  // any host that just runs `node server.js`.
  output: "standalone",
};

export default nextConfig;
