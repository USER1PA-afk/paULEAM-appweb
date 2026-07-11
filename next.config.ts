import type { NextConfig } from "next";

// Allowed CORS origin — set NEXT_PUBLIC_APP_URL in each Vercel environment:
//   Production:  https://plantadalimentos.vercel.app
//   Preview:     https://plantaalimentostest.vercel.app
const ALLOWED_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://plantadalimentos.vercel.app";

/**
 * Security headers that DO NOT need a per-request nonce (Content-Security-
 * Policy is set dynamically in proxy.ts because the nonce changes every
 * request — see proxy.ts for the live CSP and the per-request generator).
 *
 * Anything that is constant across requests lives here so the proxy stays
 * cheap.
 */
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
        // Static security headers on every response. The Content-Security-
        // Policy lives in proxy.ts because it carries a per-request nonce.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control",   value: "on" },
          {
            key:   "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Service worker: allow root scope + let the browser revalidate sw.js
        // on every navigation so updates roll out promptly.
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        // PWA manifest — must be served with the correct content type for
        // Chrome to parse it and fire beforeinstallprompt.
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
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
