import { localeFromParams } from "@/lib/locale";
import { getFeeConfig } from "@/lib/fees";
import { Button, Card, Input, Label, PageTitle } from "@/components/ui";
import { adminSettingsAction } from "../actions";

export default async function AdminSettings({ params }: { params: Promise<{ locale: string }> }) {
  const { t } = await localeFromParams(params);
  const fee = await getFeeConfig();
  return (
    <div className="space-y-6">
      <PageTitle>{t("admin.nav_settings")}</PageTitle>
      <Card>
        <form action={adminSettingsAction} className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <div>
            <Label htmlFor="fee_bps">{t("admin.fee_bps")}</Label>
            <Input id="fee_bps" name="fee_bps" inputMode="numeric" defaultValue={fee.feeBps} />
          </div>
          <div>
            <Label htmlFor="fee_min_cents">{t("admin.fee_min")}</Label>
            <Input id="fee_min_cents" name="fee_min_cents" inputMode="numeric" defaultValue={fee.feeMinCents} />
          </div>
          <div className="sm:col-span-2">
            <Button>{t("common.save")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
