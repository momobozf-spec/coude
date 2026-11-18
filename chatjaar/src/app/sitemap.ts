import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/dictionaries";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const paths = ["", "/start", "/privacy", "/terms", "/imprint"];
  return LOCALES.flatMap((l) => paths.map((p) => ({ url: `${base}/${l}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.5 })));
}
