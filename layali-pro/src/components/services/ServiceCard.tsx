import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin, Globe, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import type { ServiceWithRelations } from "@/types";

/** Maps a service-category slug to an AtmosphereTile glyph category. */
const SERVICE_GLYPH: Record<string, string> = {
  "event-styling": "gifts",
  "wedding-decor": "wedding-henna",
  "henna-artists": "wedding-henna",
  "tea-catering": "tea-experience",
  photography: "seasonal",
  beauty: "hammam-wellness",
  "interior-styling": "home-decor",
  "gift-styling": "gifts",
  workshops: "kitchen-serving",
  branding: "fragrance",
};

/**
 * ServiceCard — marketplace card for a service offering.
 * Server component (no cart interaction) with a "view details" CTA, vendor
 * name, price-from and location/online indicator.
 */
export default async function ServiceCard({ service }: { service: ServiceWithRelations }) {
  const t = await getTranslations("services");
  const glyph = SERVICE_GLYPH[service.category.slug] || "gifts";

  return (
    <Link href={`/services/${service.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-soft">
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]">
          <AtmosphereTile seed={service.slug} label={service.title} category={glyph} />
        </div>
        {service.popular && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-burgundy px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {t("popular")}
          </span>
        )}
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-medium text-secondary backdrop-blur-sm">
          {service.online ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
          {service.online ? t("online") : service.location || t("onLocation")}
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{service.category.name}</p>
        <h3 className="text-sm font-medium leading-snug transition-colors group-hover:text-emerald">{service.title}</h3>
        {service.shortDesc && <p className="line-clamp-2 text-xs text-muted-foreground">{service.shortDesc}</p>}
        <p className="text-[11px] text-muted-foreground">{t("by")} <span className="text-secondary">{service.vendor.name}</span></p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-semibold">
            {service.priceType === "QUOTE" || service.priceFrom == null
              ? t("onRequest")
              : <>{service.priceType === "FROM" && <span className="text-xs font-normal text-muted-foreground">{t("from")} </span>}{formatPrice(service.priceFrom)}</>}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald">
            {t("viewDetails")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
