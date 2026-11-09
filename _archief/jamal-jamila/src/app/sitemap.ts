import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";

const locales = ["nl", "fr"];
const staticPaths = [
  "",
  "/products",
  "/about",
  "/contact",
  "/faq",
  "/shipping-returns",
  "/privacy",
  "/terms",
  "/cookies",
  "/login",
  "/register",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.url.replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of staticPaths) {
      entries.push({
        url: `${base}/${locale}${path}`,
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.6,
      });
    }
  }

  // Dynamic product + category pages.
  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
      prisma.category.findMany({ select: { slug: true } }),
    ]);
    for (const locale of locales) {
      for (const p of products) {
        entries.push({
          url: `${base}/${locale}/products/${p.slug}`,
          lastModified: p.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
      for (const c of categories) {
        entries.push({
          url: `${base}/${locale}/products?category=${c.slug}`,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    }
  } catch (err) {
    console.error("[sitemap] failed to load dynamic entries:", err);
  }

  return entries;
}
