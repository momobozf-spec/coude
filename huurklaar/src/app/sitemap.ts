import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const paths = ["", "/dossier", "/check", "/prijzen", "/privacy", "/voorwaarden"];
  return ["nl", "fr"].flatMap((l) => paths.map((p) => ({ url: `${base}/${l}${p}`, changeFrequency: "weekly" as const })));
}
