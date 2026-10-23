import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import VendorCard from "@/components/vendors/VendorCard";
import type { VendorSummary } from "@/types";

export const metadata: Metadata = {
  title: "Verkopers",
  description: "Ontdek de zorgvuldig geselecteerde verkopers en aanbieders achter Layali.",
  alternates: { canonical: `${brand.url}/vendors` },
};

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function VendorsPage({ searchParams }: Props) {
  const params = await searchParams;
  const t = await getTranslations("vendors");

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.type === "products") where.type = { in: ["PRODUCTS", "BOTH"] };
  if (params.type === "services") where.type = { in: ["SERVICES", "BOTH"] };

  const vendors = await prisma.vendor.findMany({ where, orderBy: [{ featured: "desc" }, { name: "asc" }] });

  const filters = [
    { key: undefined, label: t("filterAll") },
    { key: "products", label: t("filterProducts") },
    { key: "services", label: t("filterServices") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">{t("home")}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{t("title")}</span>
      </nav>

      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel">{t("eyebrow")}</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = params.type === f.key || (!params.type && !f.key);
          return (
            <Link key={f.label} href={f.key ? `/vendors?type=${f.key}` : "/vendors"} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${active ? "border-emerald bg-emerald text-white" : "border-border text-muted-foreground hover:border-emerald/50"}`}>
              {f.label}
            </Link>
          );
        })}
      </div>

      {vendors.length === 0 ? (
        <p className="py-24 text-center text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((v) => (
            <VendorCard key={v.id} vendor={v as unknown as VendorSummary} />
          ))}
        </div>
      )}

      {/* Become a seller CTA */}
      <section className="mt-16 overflow-hidden rounded-3xl bg-secondary px-8 py-12 text-center text-white sm:px-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/80">{t("ctaBody")}</p>
        <Link href="/sell" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-secondary transition-colors hover:bg-gold/90">
          {t("ctaButton")}
        </Link>
      </section>
    </div>
  );
}
