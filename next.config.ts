import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chargés par Node tels quels (pas bundlés) : `ws` casse une fois bundlé (dépendances
  // natives optionnelles bufferutil / utf-8-validate), et le driver Neon l'importe.
  serverExternalPackages: ["@neondatabase/serverless", "ws"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;