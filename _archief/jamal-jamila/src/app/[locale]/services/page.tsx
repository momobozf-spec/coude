import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import ServiceGrid from "@/components/services/ServiceGrid";
import type { ServiceWithRelations } from "@/types";

export const metadata: Metadata = {
  title: "Services",
  description: "Ontdek unieke oriental services — event styling, henna, tea experience, fotografie, beauty en meer.",
  alternates: { canonical: `${brand.url}/services` },
};

interface ServicesPageProps {
  searchParams: Promise<{ search?: string; category?: string; sort?: string; online?: string }>;
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const params = await searchParams;
  const t = await getTranslations("services");

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.search) where.OR = [{ title: { contains: params.search } }, { description: { contains: params.search } }];
  if (params.category) where.category = { slug: params.category };
  if (params.online === "true") where.online = true;

  const orderBy: Record<string, string> = {};
  switch (params.sort) {
    case "price_asc": orderBy.priceFrom = "asc"; break;
    case "price_desc": orderBy.priceFrom = "desc"; break;
    case "popular": orderBy.popular = "desc"; break;
    default: orderBy.createdAt = "desc";
  }

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where,
      include: { vendor: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
      orderBy,
    }),
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const activeCat = params.category ? categories.find((c) => c.slug === params.category) : null;
  const title = params.search ? `"${params.search}"` : activeCat?.name || t("title");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">{t("home")}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{title}</span>
      </nav>

      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel">{t("eyebrow")}</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Filters */}
        <aside className="w-full shrink-0 lg:w-64">
          <form action={`/services`} className="mb-6">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input name="search" defaultValue={params.search} placeholder={t("searchPlaceholder")} className="h-11 w-full rounded-full border border-border bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </form>

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-caramel">{t("categories")}</h3>
          <ul className="space-y-1">
            <li>
              <Link href="/services" className={`block rounded-lg px-3 py-2 text-sm transition-colors ${!params.category ? "bg-emerald/10 font-medium text-emerald" : "text-muted-foreground hover:bg-muted"}`}>
                {t("allCategories")}
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/services?category=${c.slug}`} className={`block rounded-lg px-3 py-2 text-sm transition-colors ${params.category === c.slug ? "bg-emerald/10 font-medium text-emerald" : "text-muted-foreground hover:bg-muted"}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-medium">{t("becomeProviderTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("becomeProviderDesc")}</p>
            <Link href="/sell" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-terracotta-dark">
              {t("becomeProviderCta")}
            </Link>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {[
              { key: "newest", label: t("sortNewest") },
              { key: "popular", label: t("sortPopular") },
              { key: "price_asc", label: t("sortPriceAsc") },
              { key: "price_desc", label: t("sortPriceDesc") },
            ].map((s) => {
              const qs = new URLSearchParams();
              if (params.category) qs.set("category", params.category);
              if (params.search) qs.set("search", params.search);
              qs.set("sort", s.key);
              const active = (params.sort || "newest") === s.key;
              return (
                <Link key={s.key} href={`/services?${qs.toString()}`} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${active ? "border-emerald bg-emerald text-white" : "border-border text-muted-foreground hover:border-emerald/50"}`}>
                  {s.label}
                </Link>
              );
            })}
          </div>

          {services.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-24 text-center">
              <p className="text-lg font-medium">{t("noResults")}</p>
              <Link href="/services" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-terracotta-dark">
                {t("clearFilters")}
              </Link>
            </div>
          ) : (
            <ServiceGrid services={services as unknown as ServiceWithRelations[]} />
          )}
        </div>
      </div>
    </div>
  );
}
