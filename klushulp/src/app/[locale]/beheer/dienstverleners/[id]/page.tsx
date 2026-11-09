import { notFound } from "next/navigation";
import { localeFromParams, formatDateTime } from "@/lib/locale";
import { getProviderForAdmin } from "@/lib/services/admin";
import { pick, type MessageKey } from "@/i18n";
import { Alert, Badge, Button, Card, DescriptionList, Input, Label, PageTitle, SectionTitle } from "@/components/ui";
import { adminProviderStatusAction, adminVerificationAction } from "../../actions";

export default async function AdminProviderDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { id } = await params;
  const data = await getProviderForAdmin(id);
  if (!data) notFound();
  const { provider: p, user: u, verifications, categories, missing, required } = data;
  const kinds = ["kbo", "identity", "insurance", "certificate"] as const;
  return (
    <div className="space-y-6">
      <PageTitle sub={`${u.email} · ${p.status}`}>{p.displayName}</PageTitle>
      <Card>
        <DescriptionList
          items={[
            { k: t("join.business_name"), v: p.businessName ?? "—" },
            { k: "KBO", v: p.kboNumber ?? "—" },
            { k: t("join.type_label"), v: p.type },
            { k: t("prof.categories"), v: categories.map((c) => pick(c.category, "name", locale)).join(", ") || "—" },
            { k: t("prof.base_postcode"), v: `${p.basePostcode ?? "—"} ${p.baseMunicipality ?? ""} · ${p.radiusKm} km` },
            { k: t("prof.phone"), v: p.phone ?? "—" },
            { k: t("prof.bio"), v: p.bio || "—" },
          ]}
        />
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t("admin.nav_verifications")}</SectionTitle>
        {required.length > 0 && <p className="text-sm text-muted">{t("ver.required_for", { cats: required.map((k) => t(`ver.kind_${k}` as MessageKey)).join(", ") })}</p>}
        {kinds.map((kind) => {
          const v = verifications.find((x) => x.kind === kind);
          const status = v?.status ?? "missing";
          return (
            <div key={kind} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
              <div>
                <p className="font-semibold">
                  {t(`ver.kind_${kind}` as MessageKey)} <Badge tone={status === "approved" ? "ok" : status === "pending" ? "warn" : status === "rejected" ? "danger" : "neutral"}>{t(`ver.status_${status}` as MessageKey)}</Badge>
                </p>
                {v?.reference && <p className="text-sm">{v.reference}</p>}
                {v?.documentPath && (
                  <a href={`/files/${v.documentPath}`} target="_blank" rel="noopener" className="text-sm text-brand underline-offset-4 hover:underline">
                    {t("ver.document")}
                  </a>
                )}
                {v?.note && <p className="text-xs text-muted">{v.note}</p>}
                {v?.reviewedAt && <p className="text-xs text-muted">{formatDateTime(v.reviewedAt, locale)}</p>}
              </div>
              {v && status !== "approved" && (
                <form action={adminVerificationAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={v.id} />
                  <div>
                    <Label htmlFor={`note-${kind}`}>{t("admin.note")}</Label>
                    <Input id={`note-${kind}`} name="note" className="min-h-10" />
                  </div>
                  <Button name="decision" value="approved" className="min-h-10">
                    {t("admin.approve")}
                  </Button>
                  <Button name="decision" value="rejected" variant="danger" className="min-h-10">
                    {t("admin.reject")}
                  </Button>
                </form>
              )}
            </div>
          );
        })}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t("common.status")}</SectionTitle>
        {p.status !== "active" && missing.length > 0 && <Alert tone="warn">{t("admin.activate_blocked", { missing: missing.map((k) => t(`ver.kind_${k}` as MessageKey)).join(", ") })}</Alert>}
        <div className="flex flex-wrap gap-2">
          {p.status !== "active" && p.status !== "suspended" && (
            <form action={adminProviderStatusAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="action" value="activate" />
              <Button disabled={missing.length > 0}>{t("admin.activate")}</Button>
            </form>
          )}
          {p.status !== "suspended" ? (
            <form action={adminProviderStatusAction} className="flex items-end gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="action" value="suspend" />
              <div>
                <Label htmlFor="reason">{t("admin.note")}</Label>
                <Input id="reason" name="reason" className="min-h-10" />
              </div>
              <Button variant="danger" className="min-h-10">
                {t("admin.suspend")}
              </Button>
            </form>
          ) : (
            <form action={adminProviderStatusAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="action" value="unsuspend" />
              <Button variant="secondary">{t("admin.unsuspend")}</Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
