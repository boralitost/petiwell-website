/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // External drives / EMFILE can break the image optimizer (ResponseAborted).
  // Serve public assets directly so images always load in local preview.
  images: {
    unoptimized: true
  }
};

export default nextConfig;
