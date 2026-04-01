import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "@prisma/client"],
};

export default nextConfig;
