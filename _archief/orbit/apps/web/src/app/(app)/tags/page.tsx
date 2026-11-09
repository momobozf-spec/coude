import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Tags' };

export default function Page() {
  return (
    <>
      <PageHeader title="Tags" subtitle="Eén tagsysteem voor taken, notities, ideeën en projecten" />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <EmptyState
          icon="tag"
          title="Nog geen tags in gebruik"
          description="Tags werken over alle types heen, zodat Werk of Klanten overal hetzelfde betekent."
        />
      </div>
    </>
  );
}
