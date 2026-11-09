import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getItem, todayFor } from '@orbit/api-core';
import { DomainError, listTags } from '@orbit/db';
import { ErrorCode } from '@orbit/types';
import { TaskDetail } from '@/components/tasks/task-detail';
import { PageHeader } from '@/components/ui/primitives';
import { requireServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await requireServerSession(`/taken/${id}`);
  try {
    const record = await getItem(session.scope, id);
    return { title: record.item.title };
  } catch {
    return { title: 'Item' };
  }
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireServerSession(`/taken/${id}`);

  let record;
  try {
    record = await getItem(scope, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === ErrorCode.NotFound) notFound();
    throw error;
  }

  const allTags = await listTags(scope);
  const tags = allTags.filter((tag) => record.tagIds.includes(tag.id));

  return (
    <>
      <PageHeader title="Taak" />
      <TaskDetail
        item={record.item}
        checklist={record.checklist}
        subtasks={record.subtasks}
        tags={tags}
        today={todayFor(scope)}
      />
    </>
  );
}
