import { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://noorprintables.com";

const BLOG_POSTS = [
  { slug: "ramadan-activities-kids", date: "2026-03-01" },
  { slug: "islamic-homeschool-printables", date: "2026-03-10" },
  { slug: "arabic-alphabet-teaching-tips", date: "2026-03-20" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: `${BASE}/`, changeFrequency: "weekly" as const, priority: 1.0 },
    { url: `${BASE}/login`, changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${BASE}/register`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${BASE}/islamic-coloring-pages`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/ramadan-worksheets`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/arabic-letters-coloring`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/eid-printables`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/islamic-school-worksheets`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/blog`, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${BASE}/academy`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/academy/arabic-alphabet-adventure`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE}/academy/ramadan-with-noor`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE}/academy/99-names-of-allah`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE}/ramadan-challenge`, changeFrequency: "weekly" as const, priority: 0.95 },
    { url: `${BASE}/marketplace`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${BASE}/sell`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE}/white-label`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE}/books`, changeFrequency: "weekly" as const, priority: 0.8 },
  ];

  const blogPages = BLOG_POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
