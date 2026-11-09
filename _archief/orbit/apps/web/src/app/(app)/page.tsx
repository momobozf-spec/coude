import type { Metadata } from 'next';
import Link from 'next/link';
import { getDashboard } from '@orbit/api-core';
import { listTags } from '@orbit/db';
import { ItemType } from '@orbit/types';
import { Icon, type IconName } from '@/components/icons';
import { TaskList } from '@/components/tasks/task-list';
import { Card, EmptyState, PageHeader, SectionHeading } from '@/components/ui/primitives';
import { requireServerSession } from '@/lib/session';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

/**
 * Het persoonlijke dashboard uit de requirements (par. 19).
 *
 * Alles komt uit één `getDashboard`-aanroep in plaats van zes losse requests:
 * dit scherm opent bij elke sessie als eerste en moet daarom in één rondje klaar zijn.
 */
export default async function DashboardPage() {
  const { scope, user } = await requireServerSession('/');
  const [data, tags] = await Promise.all([getDashboard(scope), listTags(scope)]);

  const tagLookup = Object.fromEntries(
    tags.map((tag) => [tag.id, { name: tag.name, color: tag.color }]),
  );

  const firstName = user.name.split(' ')[0] ?? user.name;
  const greeting = `${greetingForHour(new Date().getHours())}, ${firstName}`;

  return (
    <>
      <PageHeader title={greeting} subtitle={subtitleFor(data.summary.todayCount, data.summary.highPriorityCount)} />

      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Vandaag" value={data.summary.todayCount} icon="sun" href="/vandaag" />
          <StatTile
            label="Achterstallig"
            value={data.summary.overdueCount}
            icon="clock"
            tone={data.summary.overdueCount > 0 ? 'danger' : 'neutral'}
            href="/vandaag"
          />
          <StatTile label="Komend" value={data.summary.upcomingCount} icon="calendar-days" href="/komend" />
          <StatTile label="Inbox" value={data.summary.inboxCount} icon="inbox" href="/inbox" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            {data.overdue.length > 0 ? (
              <section>
                <SectionHeading title="Achterstallig" count={data.overdue.length} />
                <Card className="overflow-hidden p-0">
                  <TaskList entries={data.overdue} today={data.date} tags={tagLookup} />
                </Card>
              </section>
            ) : null}

            <section>
              <SectionHeading
                title="Vandaag"
                count={data.today.length}
                action={
                  <Link href="/vandaag" className="text-xs text-ink-tertiary hover:text-accent-text">
                    Alles bekijken
                  </Link>
                }
              />
              <Card className="overflow-hidden p-0">
                <TaskList
                  entries={data.today}
                  today={data.date}
                  tags={tagLookup}
                  emptyTitle="Niets gepland voor vandaag"
                  emptyDescription="Leg iets vast met N. Typ gerust een hele zin: Orbit haalt de datum en tijd er zelf uit."
                />
              </Card>
            </section>
          </div>

          <div className="space-y-5">
            <section>
              <SectionHeading
                title="Recente notities"
                action={
                  <Link href="/notities" className="text-xs text-ink-tertiary hover:text-accent-text">
                    Alles
                  </Link>
                }
              />
              <Card className="overflow-hidden p-0">
                {data.recentNotes.length === 0 ? (
                  <EmptyState
                    icon="note"
                    title="Nog geen notities"
                    description="Notities worden automatisch opgeslagen terwijl je typt."
                  />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {data.recentNotes.map((note) => (
                      <li key={note.id}>
                        <Link
                          href={`/notities/${note.id}`}
                          className="block px-3 py-2.5 transition-colors hover:bg-hovered"
                        >
                          <p className="truncate text-base">{note.title}</p>
                          {note.preview ? (
                            <p className="truncate text-sm text-ink-tertiary">{note.preview}</p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            <section>
              <SectionHeading
                title="Nieuwe ideeën"
                action={
                  <Link href="/ideeen" className="text-xs text-ink-tertiary hover:text-accent-text">
                    Alles
                  </Link>
                }
              />
              <Card className="overflow-hidden p-0">
                {data.recentIdeas.length === 0 ? (
                  <EmptyState
                    icon="lightbulb"
                    title="Nog geen ideeën"
                    description="Vang een inval op zonder velden in te vullen; uitwerken kan later."
                  />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {data.recentIdeas.map((idea) => (
                      <li key={idea.id}>
                        <Link
                          href={`/ideeen/${idea.id}`}
                          className="flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-hovered"
                        >
                          <Icon name="lightbulb" size={16} className="mt-0.5 shrink-0 text-idea" />
                          <span className="min-w-0">
                            <span className="block truncate text-base">{idea.title}</span>
                            {idea.type === ItemType.Idea && idea.idea.category ? (
                              <span className="block truncate text-sm text-ink-tertiary">
                                {idea.idea.category}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </div>
        </div>

        <section className="mt-5">
          <SectionHeading
            title="Projecten"
            action={
              <Link href="/projecten" className="text-xs text-ink-tertiary hover:text-accent-text">
                Alles bekijken
              </Link>
            }
          />
          {data.projects.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon="folder"
                title="Nog geen projecten"
                description="Groepeer taken, notities en ideeën die bij elkaar horen in één project."
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((project) => (
                <Link key={project.id} href={`/projecten/${project.id}`}>
                  <Card className="transition-colors hover:border-line">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden
                      />
                      <p className="truncate text-base font-medium">{project.name}</p>
                      <span className="ml-auto text-sm tabular-nums text-ink-tertiary">
                        {project.progress.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${project.progress.percent}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink-tertiary">
                      {project.progress.completedTasks} van {project.progress.totalTasks} taken
                      {project.progress.overdueTasks > 0
                        ? ` · ${project.progress.overdueTasks} achterstallig`
                        : ''}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-ink-disabled">{formatDate(data.date, { year: true })}</p>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  icon,
  href,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: IconName;
  href: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-3 p-3 transition-colors hover:border-line">
        <div
          className={
            tone === 'danger'
              ? 'flex h-9 w-9 items-center justify-center rounded-lg bg-danger-bg text-danger'
              : 'flex h-9 w-9 items-center justify-center rounded-lg bg-subtle text-ink-tertiary'
          }
        >
          <Icon name={icon} size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-none tabular-nums">{value}</p>
          <p className="mt-1 truncate text-xs text-ink-tertiary">{label}</p>
        </div>
      </Card>
    </Link>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 6) return 'Goedenacht';
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function subtitleFor(todayCount: number, highPriority: number): string {
  if (todayCount === 0) return 'Geen taken voor vandaag';
  const taken = `${todayCount} ${todayCount === 1 ? 'taak' : 'taken'} vandaag`;
  return highPriority > 0 ? `${taken}, ${highPriority} met hoge prioriteit` : taken;
}
