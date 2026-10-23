import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const base = brand.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Don't index account, admin, checkout or API surfaces.
        disallow: ["/admin", "/api", "/*/account", "/*/checkout"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
