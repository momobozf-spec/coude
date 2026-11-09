import { eq } from "drizzle-orm";
import { localeFromParams } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { getCategories } from "@/lib/catalog";
import { db } from "@/db";
import { providerCategory } from "@/db/schema";
import { pick, type MessageKey } from "@/i18n";
import { Card, PageTitle } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";

const KEYS: MessageKey[] = ["prof.display_name", "prof.bio", "prof.bio_help", "prof.phone", "prof.years", "prof.hourly_rate", "prof.travel_fee", "prof.categories", "prof.services", "prof.category_not_allowed", "prof.base_postcode", "prof.radius", "prof.photo", "common.save", "common.saved", "common.loading", "common.error_generic", "common.optional", "common.required", "req.postcode_unknown", "cat.pro_only"];

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { provider } = (await getCurrentProvider())!;
  const cats = await getCategories();
  const mine = await db.select().from(providerCategory).where(eq(providerCategory.providerId, provider.id));
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(k)]));
  return (
    <div className="space-y-6">
      <PageTitle>{t("prof.title")}</PageTitle>
      <Card>
        <ProfileForm
          locale={locale}
          labels={labels}
          categories={cats.map((c) => ({ id: c.id, name: pick(c, "name", locale), allowed: c.allowedProviderTypes.includes(provider.type) }))}
          initial={{
            displayName: provider.displayName,
            bio: provider.bio,
            phone: provider.phone ?? "",
            yearsExperience: provider.yearsExperience?.toString() ?? "",
            hourlyRate: provider.hourlyRateCents != null ? (provider.hourlyRateCents / 100).toFixed(2) : "",
            travelFee: (provider.travelFeeCents / 100).toFixed(2),
            basePostcode: provider.basePostcode ?? "",
            radiusKm: provider.radiusKm,
            photoPath: provider.photoPath,
            categories: mine.map((m) => ({ categoryId: m.categoryId, services: m.services })),
          }}
        />
      </Card>
    </div>
  );
}
