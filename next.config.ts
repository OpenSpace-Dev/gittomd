import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: true,

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Bundle analyzer (can be enabled for debugging)
  // ...(process.env.ANALYZE === 'true' && { webpack: require('@next/bundle-analyzer')() }),

  // Enable logging for better debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

};

export default nextConfig;
