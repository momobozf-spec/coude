import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, MapPin, Globe, BadgeCheck, ShieldCheck, Sparkles, Check } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import { formatPrice } from "@/lib/utils";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import ServiceGrid from "@/components/services/ServiceGrid";
import type { ServiceWithRelations } from "@/types";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service) return { title: "Service niet gevonden" };
  const desc = service.shortDesc || service.description.substring(0, 160);
  return {
    title: service.title,
    description: desc,
    alternates: { canonical: `${brand.url}/${locale}/services/${slug}` },
    openGraph: { title: service.title, description: desc, type: "website" },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("services");
  const service = await prisma.service.findUnique({
    where: { slug, status: "ACTIVE" },
    include: {
      vendor: { select: { id: true, name: true, slug: true, location: true, verified: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!service) notFound();

  const related = await prisma.service.findMany({
    where: { categoryId: service.categoryId, id: { not: service.id }, status: "ACTIVE" },
    include: { vendor: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } },
    take: 3,
  });

  const priceLabel =
    service.priceType === "QUOTE" || service.priceFrom == null
      ? t("onRequest")
      : `${service.priceType === "FROM" ? t("from") + " " : ""}${formatPrice(service.priceFrom)}`;

  const contactHref = `/contact?subject=${encodeURIComponent(`${t("bookingSubject")}: ${service.title}`)}`;

  // Service JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.shortDesc || service.description.substring(0, 200),
    provider: { "@type": "Organization", name: service.vendor.name },
    areaServed: service.location || "BE/NL",
    category: service.category.name,
    ...(service.priceFrom != null && {
      offers: { "@type": "Offer", price: service.priceFrom.toFixed(2), priceCurrency: "EUR" },
    }),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">{t("home")}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/services" className="hover:text-foreground">{t("title")}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{service.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Visual */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card">
            <AtmosphereTile seed={service.slug} label={service.title} category="gifts" glyphClassName="h-1/4 w-1/4" />
          </div>

          {/* Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel">{service.category.name}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{service.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <Link href={`/vendors/${service.vendor.slug}`} className="inline-flex items-center gap-1.5 font-medium text-secondary hover:text-emerald">
                {service.vendor.verified && <BadgeCheck className="h-4 w-4 text-emerald" />}
                {service.vendor.name}
              </Link>
              <span className="inline-flex items-center gap-1.5">
                {service.online ? <Globe className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                {service.online ? t("online") : service.location || t("onLocation")}
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald">{priceLabel}</span>
              {service.priceType === "FROM" && <span className="text-sm text-muted-foreground">{t("priceFromNote")}</span>}
            </div>

            <p className="mt-6 whitespace-pre-line leading-relaxed text-muted-foreground">{service.description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={contactHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-emerald/20 transition-colors hover:bg-terracotta-dark">
                {t("bookCta")}
              </Link>
              <Link href={`/vendors/${service.vendor.slug}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-secondary/25 px-8 py-3.5 text-sm font-medium text-secondary transition-colors hover:bg-muted">
                {t("viewProvider")}
              </Link>
            </div>

            {/* Trust block */}
            <div className="mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-white p-5 sm:grid-cols-3">
              {[
                { icon: BadgeCheck, label: t("trustVerified") },
                { icon: Sparkles, label: t("trustCurated") },
                { icon: ShieldCheck, label: t("trustSecure") },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <b.icon className="h-4 w-4 shrink-0 text-emerald" />
                  {b.label}
                </div>
              ))}
            </div>

            {service.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    <Check className="h-3 w-3" />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20 border-t border-border pt-12">
            <h2 className="mb-8 text-2xl font-bold tracking-tight">{t("related")}</h2>
            <ServiceGrid services={related as unknown as ServiceWithRelations[]} />
          </section>
        )}
      </div>
    </div>
  );
}
