import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "next-build",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    webpackBuildWorker: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
