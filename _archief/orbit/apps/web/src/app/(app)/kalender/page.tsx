import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Kalender' };

export default function Page() {
  return (
    <>
      <PageHeader title="Kalender" subtitle="Dag, week en maand" />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <EmptyState
          icon="calendar"
          title="Nog niets in de kalender"
          description="Taken met een deadline en herinneringen verschijnen hier automatisch."
        />
      </div>
    </>
  );
}
