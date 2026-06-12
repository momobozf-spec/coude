import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, MapPin, BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import ProductGrid from "@/components/products/ProductGrid";
import ServiceGrid from "@/components/services/ServiceGrid";
import type { ServiceWithRelations } from "@/types";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { slug } });
  if (!vendor) return { title: "Verkoper niet gevonden" };
  return {
    title: vendor.name,
    description: vendor.tagline || vendor.description || `Ontdek ${vendor.name} op Layali.`,
    alternates: { canonical: `${brand.url}/${locale}/vendors/${slug}` },
  };
}

export default async function VendorProfilePage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("vendors");

  const vendor = await prisma.vendor.findUnique({
    where: { slug, status: "ACTIVE" },
    include: {
      products: {
        where: { status: "ACTIVE" },
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      },
      services: {
        where: { status: "ACTIVE" },
        include: { vendor: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!vendor) notFound();

  const typeLabel = vendor.type === "SERVICES" ? t("typeServices") : vendor.type === "BOTH" ? t("typeBoth") : t("typeProducts");

  return (
    <div>
      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden sm:h-72">
        <AtmosphereTile seed={vendor.imageSeed || vendor.slug} label="" category={vendor.type === "SERVICES" ? "gifts" : "home-decor"} showLabel={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header card */}
        <div className="-mt-16 rounded-3xl border border-border bg-white p-6 shadow-card sm:p-8">
          <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">{t("home")}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/vendors" className="hover:text-foreground">{t("title")}</Link>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{vendor.name}</h1>
                {vendor.verified && <BadgeCheck className="h-6 w-6 text-emerald" />}
              </div>
              {vendor.tagline && <p className="mt-1 text-muted-foreground">{vendor.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-3 py-1 font-medium text-secondary">{typeLabel}</span>
                {vendor.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vendor.location}</span>}
              </div>
            </div>
          </div>
          {vendor.description && <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">{vendor.description}</p>}
        </div>

        {/* Products */}
        {vendor.products.length > 0 && (
          <section className="py-14">
            <h2 className="mb-8 text-2xl font-bold tracking-tight">{t("products")}</h2>
            <ProductGrid products={vendor.products} />
          </section>
        )}

        {/* Services */}
        {vendor.services.length > 0 && (
          <section className="pb-16">
            <h2 className="mb-8 text-2xl font-bold tracking-tight">{t("services")}</h2>
            <ServiceGrid services={vendor.services as unknown as ServiceWithRelations[]} />
          </section>
        )}

        {vendor.products.length === 0 && vendor.services.length === 0 && (
          <p className="py-24 text-center text-muted-foreground">{t("noListings")}</p>
        )}
      </div>
    </div>
  );
}
