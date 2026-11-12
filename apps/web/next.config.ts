import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT === "1" ? "export" : process.env.STANDALONE_BUILD === "1" ? "standalone" : undefined,
  poweredByHeader: false,
};

export default nextConfig;

