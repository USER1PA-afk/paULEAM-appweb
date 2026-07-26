import type { NextConfig } from "next";

// Allowed CORS origin — set NEXT_PUBLIC_APP_URL in each Vercel environment:
//   Production:  https://pauleam.vercel.app
//   Preview:     https://pauleam-git-*.vercel.app
const ALLOWED_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

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
    // Image optimizer tries AVIF first (smaller, modern), then WebP
    // (universal). Browsers that accept neither get the original.
    formats: ["image/avif", "image/webp"],
    // Keep optimized variants in the optimizer cache for 30 days. Insforge
    // storage has no Cache-Control header of its own, so the optimizer
    // response is the only cache layer most clients see.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "*.insforge.app" },
      // cdn.insforge.dev is the actual CDN host for stored objects (the API
      // host 301s to it). Both must be allowlisted for the optimizer to
      // fetch product / receipt / QR images.
      { protocol: "https", hostname: "cdn.insforge.dev" },
      { protocol: "https", hostname: "*.insforge.dev" },
    ],
  },

  async headers() {
    const IS_PROD = process.env.NODE_ENV === "production";

    const rules = [
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

    // Production-only: serve hashed _next/static chunks with a year-long
    // immutable cache. In dev we leave defaults alone so HMR / RSC payload
    // reloads work as expected — Next.js warns if we don't gate this.
    //
    // The optimizer URL (/_next/image) is intentionally NOT overridden here.
    // `images.minimumCacheTTL` already drives its Cache-Control in prod.
    if (IS_PROD) {
      rules.push({
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      });
    }

    return rules;
  },
};

export default nextConfig;
