import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node:sqlite is a Node.js builtin - keep it out of the bundler graph.
  serverExternalPackages: [],
};

export default nextConfig;
