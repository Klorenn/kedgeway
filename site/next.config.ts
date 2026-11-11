import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A lockfile in the parent folder confuses workspace-root inference; pin the root to this app.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
