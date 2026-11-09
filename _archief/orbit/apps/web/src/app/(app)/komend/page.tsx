import type { Metadata } from 'next';
import { TaskView } from '@orbit/types';
import { TaskViewPage } from '@/components/tasks/task-view-page';

export const metadata: Metadata = { title: 'Komend' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <TaskViewPage
      view={TaskView.Upcoming}
      path="/komend"
      subtitle="Gegroepeerd per periode"
      grouped
      emptyTitle="Nog niets gepland"
      emptyDescription="Taken met een datum in de toekomst verschijnen hier, gegroepeerd per dag."
    />
  );
}
