import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Projecten' };

export default function Page() {
  return (
    <>
      <PageHeader title="Projecten" subtitle="Taken, notities en ideeën per project" />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <EmptyState
          icon="folder"
          title="Nog geen projecten"
          description="Een project bundelt alles wat bij elkaar hoort en toont de voortgang."
        />
      </div>
    </>
  );
}
