import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use dynamic rendering - will deploy to Cloud Run or use Firebase Hosting with Cloud Functions
  // For now, disable static export to allow dynamic routes
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
