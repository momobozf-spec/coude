import type { Metadata } from 'next';
import { Card, PageHeader, SectionHeading } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export const metadata: Metadata = { title: 'Instellingen' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Instellingen" />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-5 sm:px-6">
        <section>
          <SectionHeading title="Weergave" />
          <Card className="space-y-4">
            <SettingRow
              label="Thema"
              description="Licht, donker of automatisch meebewegen met je systeem."
            >
              <ThemeToggle expanded />
            </SettingRow>
          </Card>
        </section>

        <section>
          <SectionHeading title="Account" />
          <Card>
            <p className="text-sm text-ink-tertiary">
              Profiel, wachtwoord en gekoppelde accounts komen hier zodra de
              inlogschermen aan de API hangen.
            </p>
          </Card>
        </section>
      </div>
    </>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-ink-tertiary">{description}</p>
      </div>
      {children}
    </div>
  );
}
