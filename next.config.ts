import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // groq-sdk uses Node.js built-ins — keep it server-side only
  serverExternalPackages: ["groq-sdk"],
};

export default nextConfig;

