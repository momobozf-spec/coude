import type { MetadataRoute } from "next";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is useful to a crawler, and some of it is per-user.
      disallow: ["/api/", "/nl/account", "/en/account", "/fr/account", "/de/account"],
    },
    sitemap: `${APP}/sitemap.xml`,
  };
}
