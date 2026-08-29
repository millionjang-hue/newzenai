import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pg` opens raw sockets and optionally loads pg-native; keep it out of the
  // bundle and let Node require it at run time.
  serverExternalPackages: ["pg"],
  // Vercel builds its own function output. Everywhere else, emit
  // .next/standalone/server.js so the Docker image is self-contained.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
