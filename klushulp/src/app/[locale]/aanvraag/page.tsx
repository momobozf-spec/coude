import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { localeFromParams } from "@/lib/locale";
import { getCategories, getActiveRegions, suggestCategory } from "@/lib/catalog";
import { pick } from "@/i18n";
import { db } from "@/db";
import { provider } from "@/db/schema";
import { RequestWizard, type WizardCategory } from "@/components/request-wizard";
import { env } from "@/lib/env";
import { MAX_PHOTOS, MIN_DESCRIPTION } from "@/lib/services/requests";

export const metadata: Metadata = { title: "Klus plaatsen" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale, t } = await localeFromParams(params);
  const sp = await searchParams;
  const [cats, regions] = await Promise.all([getCategories(), getActiveRegions()]);
  const regionNames = regions.map((r) => pick(r, "name", locale)).join(", ");

  const wizardCats: WizardCategory[] = cats.map((c) => ({
    slug: c.slug,
    name: pick(c, "name", locale),
    description: pick(c, "description", locale),
    questions: c.followupQuestions.map((q) => ({ key: q.key, type: q.type, label: locale === "fr" ? q.labelFr : q.labelNl, options: q.options?.map((o) => ({ value: o.value, label: locale === "fr" ? o.fr : o.nl })) })),
  }));

  const initialDescription = sp.d ?? "";
  const suggested = sp.c && cats.some((c) => c.slug === sp.c) ? sp.c : suggestCategory(initialDescription, cats.map((c) => ({ slug: c.slug, keywords: c.keywords })));

  let target: { id: string; name: string; categorySlugs: string[] } | null = null;
  if (sp.voor) {
    const [p] = await db.select().from(provider).where(eq(provider.id, sp.voor)).limit(1);
    if (p && p.status === "active") {
      const { providerCategory, category } = await import("@/db/schema");
      const pcs = await db.select({ slug: category.slug }).from(providerCategory).innerJoin(category, eq(category.id, providerCategory.categoryId)).where(eq(providerCategory.providerId, p.id));
      target = { id: p.id, name: p.displayName, categorySlugs: pcs.map((x) => x.slug) };
    }
  }

  // Alle teksten voor de client-wizard in één object (geen client-side dictionary nodig).
  const keys = [
    "req.title", "req.step_1", "req.step_2", "req.step_3", "req.step_of", "req.description_label", "req.description_help", "req.description_min", "req.photos_label", "req.photos_help", "req.photos_add", "req.photos_remove",
    "req.category_label", "req.category_suggest_hint", "req.postcode_label", "req.municipality_label", "req.postcode_unknown", "req.postcode_invalid", "req.street_label", "req.street_help", "req.when_label", "req.when_asap", "req.when_range",
    "req.date_from", "req.date_to", "req.date_invalid", "req.time_label", "req.time_any", "req.time_morning", "req.time_afternoon", "req.time_evening", "req.urgent_label", "req.contact_title", "req.contact_name", "req.contact_email", "req.contact_phone",
    "req.contact_email_invalid", "req.contact_help", "req.consent", "req.consent_required", "req.summary", "req.submit", "req.submitting", "req.rate_limited", "req.to_provider", "req.to_provider_help", "common.back", "common.next", "common.edit",
    "common.optional", "common.required", "common.error_generic", "cat.suggested", "cat.choose", "cat.pro_only",
  ] as const;
  const labels = Object.fromEntries(keys.map((k) => [k, t(k)])) as Record<(typeof keys)[number], string>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <RequestWizard
        locale={locale}
        categories={wizardCats}
        initial={{ description: initialDescription, place: sp.p ?? "", categorySlug: suggested ?? null, suggestedSlug: suggested ?? null }}
        target={target}
        labels={labels}
        limits={{ maxPhotos: MAX_PHOTOS, maxMb: Math.round(env.uploadMaxBytes / 1024 / 1024), minDescription: MIN_DESCRIPTION }}
        regionNames={regionNames}
      />
    </div>
  );
}
