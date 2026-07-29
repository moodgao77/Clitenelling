import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Don't reuse cached RSC for dynamic pages on client navigation — the
    // funnel report must refetch whenever the date range changes.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
