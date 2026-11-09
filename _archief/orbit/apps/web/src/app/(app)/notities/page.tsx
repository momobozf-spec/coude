import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Notities' };

export default function Page() {
  return (
    <>
      <PageHeader title="Notities" subtitle="Je notitieboeken en losse notities" />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <EmptyState
          icon="note"
          title="Nog geen notities"
          description="Notities slaan automatisch op terwijl je typt en kunnen naar elkaar verwijzen."
        />
      </div>
    </>
  );
}
