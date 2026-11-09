import Link from "next/link";
import type { ReactNode } from "react";
import type { proposal as proposalTable, provider as providerTable } from "@/db/schema";
import type { ProviderStats } from "@/lib/services/requests";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n";
import { formatCents } from "@/lib/money";
import { formatDateTime, href } from "@/lib/locale";
import { Badge, Card, Stars } from "@/components/ui";

type Proposal = typeof proposalTable.$inferSelect;
type Provider = typeof providerTable.$inferSelect;

export function VerificationBadges({ kinds, t }: { kinds: string[]; t: T }) {
  if (!kinds.length) return <Badge tone="neutral">{t("prop.no_verifications")}</Badge>;
  const map: Record<string, { label: string; explain: string }> = {
    kbo: { label: t("prop.verified_kbo"), explain: t("prop.verified_explain_kbo") },
    identity: { label: t("prop.verified_identity"), explain: t("prop.verified_explain_identity") },
    insurance: { label: t("prop.verified_insurance"), explain: t("prop.verified_explain_insurance") },
    certificate: { label: t("prop.verified_certificate"), explain: t("prop.verified_explain_certificate") },
  };
  return (
    <>
      {kinds.map((k) => (
        <Badge key={k} tone="ok" title={map[k]?.explain}>
          ✓ {map[k]?.label ?? k}
        </Badge>
      ))}
    </>
  );
}

export function ProviderHeader({ provider, stats, locale, t, link }: { provider: Provider; stats: ProviderStats | undefined; locale: Locale; t: T; link?: boolean }) {
  const name = provider.displayName;
  const reviewsLabel = !stats || stats.reviewCount === 0 ? t("prop.no_reviews") : stats.reviewCount === 1 ? t("prop.reviews_one") : t("prop.reviews", { n: stats.reviewCount });
  return (
    <div className="flex items-start gap-3">
      <ProviderAvatar provider={provider} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold leading-tight">
            {link ? (
              <Link href={href(locale, `/dienstverlener/${provider.id}`)} className="hover:underline underline-offset-4">
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
          <Badge tone={provider.type === "professional" ? "brand" : "accent"}>{provider.type === "professional" ? t("prop.pro") : t("prop.private")}</Badge>
          {provider.isDemo && <Badge tone="warn">{t("common.demo_badge")}</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <Stars value={stats?.avgRating ?? null} count={stats?.reviewCount ?? 0} label={reviewsLabel} />
          {stats && stats.completedJobs > 0 && <span>{t("prop.completed_jobs", { n: stats.completedJobs })}</span>}
          {provider.yearsExperience != null && provider.yearsExperience > 0 && <span>{t("prop.experience", { n: provider.yearsExperience })}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <VerificationBadges kinds={stats?.verifications ?? []} t={t} />
        </div>
      </div>
    </div>
  );
}

export function ProviderAvatar({ provider, size = "size-12" }: { provider: Provider; size?: string }) {
  if (provider.photoPath)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/files/${provider.photoPath}`} alt="" className={`${size} shrink-0 rounded-xl object-cover border border-line`} />;
  return (
    <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand-strong`}>
      {provider.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function priceSummary(p: Proposal, locale: Locale, t: T): { headline: string; type: string; note: string | null } {
  const f = (c: number) => formatCents(c, locale);
  switch (p.priceType) {
    case "fixed":
      return { headline: f(p.amountCents ?? 0), type: t("prop.price_fixed"), note: null };
    case "estimate":
      return { headline: `${f(p.amountMinCents ?? 0)} – ${f(p.amountMaxCents ?? 0)}`, type: t("prop.price_estimate"), note: t("prop.estimate_note") };
    case "hourly":
      return { headline: `${f(p.hourlyRateCents ?? 0)}/u`, type: t("prop.price_hourly"), note: t("prop.hourly_note", { min: p.estimatedHoursMin ?? 1, max: p.estimatedHoursMax ?? 1 }) };
    case "inspection":
      return { headline: (p.amountCents ?? 0) === 0 ? t("common.none") : f(p.amountCents ?? 0), type: t("prop.price_inspection"), note: t("prop.inspection_note") };
  }
}

export function ProposalCard({ proposal: p, provider, stats, locale, t, action, footer, status }: { proposal: Proposal; provider: Provider; stats: ProviderStats | undefined; locale: Locale; t: T; action?: ReactNode; footer?: ReactNode; status?: ReactNode }) {
  const price = priceSummary(p, locale, t);
  return (
    <Card as="article" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <ProviderHeader provider={provider} stats={stats} locale={locale} t={t} link />
        {status}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{price.type}</p>
          <p className="text-2xl font-bold">
            {price.headline} <span className="text-sm font-normal text-muted">{t("prop.vat_incl")}</span>
          </p>
          {price.note && <p className="mt-1 text-sm text-muted">{price.note}</p>}
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("prop.first_slot")}</p>
          <p className="text-lg font-bold">{formatDateTime(p.proposedStart, locale)}</p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5 text-sm">
        <li>
          <Badge tone={p.travelFeeCents ? "neutral" : "ok"}>{p.travelFeeCents ? `${t("prop.travel")}: ${formatCents(p.travelFeeCents, locale)}` : t("prop.travel_included")}</Badge>
        </li>
        <li>
          <Badge tone={p.materialsIncluded ? "ok" : "neutral"}>{p.materialsIncluded ? t("prop.materials_included") : t("prop.materials_excluded")}</Badge>
        </li>
      </ul>

      {(p.included || p.excluded || p.materialsNote) && (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {p.included && (
            <div>
              <dt className="font-semibold text-ok">{t("prop.included")}</dt>
              <dd className="whitespace-pre-wrap text-ink">{p.included}</dd>
            </div>
          )}
          {p.excluded && (
            <div>
              <dt className="font-semibold text-warn">{t("prop.excluded")}</dt>
              <dd className="whitespace-pre-wrap text-ink">{p.excluded}</dd>
            </div>
          )}
          {p.materialsNote && (
            <div className="sm:col-span-2">
              <dt className="font-semibold">{t("pf.materials_note")}</dt>
              <dd className="whitespace-pre-wrap">{p.materialsNote}</dd>
            </div>
          )}
        </dl>
      )}

      {p.message && (
        <blockquote className="rounded-xl border-l-4 border-brand/40 bg-brand-soft/40 px-4 py-2 text-sm whitespace-pre-wrap">
          {p.message}
        </blockquote>
      )}

      <p className="text-xs text-muted">
        {t("prop.platform_fee")}: {formatCents(p.platformFeeCents, locale)} — {t("prop.platform_fee_note")}
      </p>

      {action}
      {footer}
    </Card>
  );
}
