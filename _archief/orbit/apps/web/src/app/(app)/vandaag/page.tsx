import type { Metadata } from 'next';
import { TaskView } from '@orbit/types';
import { TaskViewPage } from '@/components/tasks/task-view-page';

export const metadata: Metadata = { title: 'Vandaag' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <TaskViewPage
      view={TaskView.Today}
      path="/vandaag"
      emptyTitle="Niets voor vandaag"
      emptyDescription="Geen deadlines vandaag. Achterstallige taken staan op het dashboard."
    />
  );
}
