import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Ideeën' };

export default function Page() {
  return (
    <>
      <PageHeader title="Ideeën" subtitle="Van eerste inval tot uitgewerkt project" />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <EmptyState
          icon="lightbulb"
          title="Nog geen ideeën"
          description="Leg een idee vast zonder velden in te vullen. Categorie, impact en status kun je later toevoegen."
        />
      </div>
    </>
  );
}
