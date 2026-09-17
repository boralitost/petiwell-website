/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // External drives / EMFILE can break the image optimizer (ResponseAborted).
  // Serve public assets directly so images always load in local preview.
  images: {
    unoptimized: true
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          }
        ]
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      },
      {
        source: "/:locale/marka-elcisi/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
