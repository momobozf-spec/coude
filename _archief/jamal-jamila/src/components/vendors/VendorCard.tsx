import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin, BadgeCheck, ArrowRight } from "lucide-react";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import type { VendorSummary } from "@/types";

/** Maps a vendor type to an AtmosphereTile glyph category for variety. */
const TYPE_GLYPH: Record<string, string> = {
  PRODUCTS: "home-decor",
  SERVICES: "gifts",
  BOTH: "seasonal",
};

export default async function VendorCard({ vendor }: { vendor: VendorSummary }) {
  const t = await getTranslations("vendors");

  return (
    <Link href={`/vendors/${vendor.slug}`} className="group block overflow-hidden rounded-2xl border border-border bg-white shadow-soft transition-shadow hover:shadow-card">
      <div className="relative aspect-[16/9] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]">
          <AtmosphereTile seed={vendor.imageSeed || vendor.slug} label="" category={TYPE_GLYPH[vendor.type] || "home-decor"} showLabel={false} />
        </div>
        {vendor.verified && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-emerald backdrop-blur-sm">
            <BadgeCheck className="h-3.5 w-3.5" />
            {t("verified")}
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold transition-colors group-hover:text-emerald">{vendor.name}</h3>
        {vendor.tagline && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{vendor.tagline}</p>}
        <div className="mt-3 flex items-center justify-between">
          {vendor.location && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {vendor.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald">
            {t("visitShop")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
