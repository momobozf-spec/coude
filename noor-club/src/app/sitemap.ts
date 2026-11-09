import type { MetadataRoute } from "next";
import { routing } from "@/routing";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Only the public pages. Everything behind a login is intentionally absent —
 * listing `/nl/kinderen` would just feed crawlers a redirect to the login page.
 */
const PUBLIC_PATHS = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/register", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((entry) => ({
      url: `${APP}/${locale}${entry.path}`,
      lastModified: now,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((code) => [code, `${APP}/${code}${entry.path}`]),
        ),
      },
    })),
  );
}
