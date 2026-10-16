import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: {
    // Keep pages the browser has just shown for a short while, so going back
    // to one is instant instead of another round trip. Every server action
    // that changes data revalidates, which clears this cache straight away.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
