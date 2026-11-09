import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Zoeken' };

export default function Page() {
  return (
    <>
      <PageHeader title="Zoeken" subtitle="Doorzoek taken, notities, ideeën en projecten" />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <EmptyState
          icon="search"
          title="Begin met typen"
          description="Zoek door alles tegelijk en filter op type, project, tag, status of datum."
        />
      </div>
    </>
  );
}
