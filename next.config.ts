import type { NextConfig } from "next";

// Allowed CORS origin — set NEXT_PUBLIC_APP_URL in each Vercel environment:
//   Production:  https://plantadalimentos.vercel.app
//   Preview:     https://plantaalimentostest.vercel.app
const ALLOWED_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://plantadalimentos.vercel.app";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.insforge.app",
      },
    ],
  },

  async headers() {
    return [
      {
        // Security headers on every response
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control",   value: "on" },
          {
            key:   "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // CORS: restrict API routes to known origins only
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",      value: ALLOWED_ORIGIN },
          { key: "Access-Control-Allow-Methods",     value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers",     value: "Content-Type, Authorization" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Vary",                             value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
