import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companyProfile } from "@/db/schema";
import { requireClient } from "@/lib/dal";
import { ProfileForm } from "@/components/profile-form";
import { profileToFormData } from "@/lib/profile-from-form";
import { Flash, Notice, PageTitle } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { clientSaveProfileAction } from "../actions";

export const metadata = { title: "Bedrijfsprofiel" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await requireClient();
  const p = await db.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, c.organizationId) });
  return (
    <div className="max-w-4xl">
      <PageTitle
        title="Bedrijfsprofiel"
        subtitle={p ? `Versie ${p.version} · laatst door u bevestigd: ${p.lastConfirmedByClientAt ? formatBrussels(p.lastConfirmedByClientAt, false) : "nog niet"}` : "Nog geen profiel — vul het in om beoordelingen mogelijk te maken."}
      />
      <Flash searchParams={sp} />
      <div className="mb-4">
        <Notice tone="info">
          Vul enkel in wat functioneel nodig is om opdrachten te beoordelen. Omzet is optioneel en alleen nuttig bij financiële selectievoorwaarden. Uw profiel is enkel zichtbaar voor uw organisatie en de beheerder.
        </Notice>
      </div>
      <ProfileForm action={clientSaveProfileAction} initial={profileToFormData(p)} showConfirm submitLabel="Profiel opslaan" />
    </div>
  );
}
