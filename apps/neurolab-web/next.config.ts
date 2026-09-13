import type { NextConfig } from "next";
import path from "node:path";

/** Monorepo root (…/VM). Bundled NeuroBlocks live in ../../blocks. */
const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Without this, Vercel only traces apps/neurolab-web and /explore crashes
  // when catalog() tries to read ../../blocks at runtime.
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**": ["../../blocks/**/*", "../../benchmarks/**/*"],
  },
};

export default nextConfig;
