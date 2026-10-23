import type { Metadata } from 'next'
import { Inbox as InboxIcon, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { BlockComposer } from '@/modules/planner/block-composer'
import { QuickAddTask } from '@/modules/planner/quick-add-task'
import { TaskList } from '@/modules/planner/task-list'
import { DailyTimeline } from '@/modules/my-day/daily-timeline'
import { requireActor } from '@/server/auth/actor'
import { getMyDay } from '@/server/modules/my-day/my-day.service'
import {
  listInbox,
  listUpcoming,
  MAX_DAILY_PRIORITIES,
} from '@/server/modules/planner/task.service'
import { formatDate, todayIn } from '@/lib/dates'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Planner',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PlannerPage() {
  const actor = await requireActor()
  const today = todayIn(actor.timezone)

  const [day, inbox, upcoming] = await Promise.all([
    getMyDay(actor, today),
    listInbox(actor),
    listUpcoming(actor, today, 14),
  ])

  const openToday = day.tasks.filter((task) => task.status !== 'COMPLETED')
  const upcomingCount = upcoming.reduce((total, group) => total + group.tasks.length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.planner')}
        description="Your day, week and everything you've captured but not yet scheduled."
        action={<BlockComposer date={today} />}
      />

      <Tabs defaultValue="today">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="today" className="flex-1 sm:flex-none">
            Today
            {openToday.length > 0 ? (
              <Badge variant="default" size="sm">
                {openToday.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1 sm:flex-none">
            Upcoming
            {upcomingCount > 0 ? (
              <Badge variant="default" size="sm">
                {upcomingCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="inbox" className="flex-1 sm:flex-none">
            Inbox
            {inbox.length > 0 ? (
              <Badge variant="default" size="sm">
                {inbox.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Today ─────────────────────────────────────────────────────── */}
        <TabsContent value="today">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">Priorities</h2>
                  <span className="text-xs text-muted-foreground">
                    {day.priorities.length} of {MAX_DAILY_PRIORITIES}
                  </span>
                </div>
                <div className="mt-3">
                  <TaskList
                    tasks={day.priorities}
                    today={today}
                    emptyTitle="No priorities yet"
                    emptyBody={`Use the row menu on any task to choose up to ${MAX_DAILY_PRIORITIES}.`}
                  />
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-sm font-medium">
                  {formatDate(today, actor.locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h2>

                <QuickAddTask today={today} defaultDate={today} className="mt-3" />

                <div className="mt-3">
                  <TaskList
                    tasks={day.tasks.filter((task) => !task.isDailyPriority)}
                    today={today}
                    emptyTitle="Nothing planned"
                    emptyBody="Add a task above to shape the day."
                  />
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <h2 className="text-sm font-medium">Timeline</h2>
              <div className="mt-4">
                <DailyTimeline sections={day.timeline} />
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Upcoming ──────────────────────────────────────────────────── */}
        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <Card className="px-5 py-10 text-center">
              <p className="text-sm font-medium">Nothing scheduled ahead</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tasks you schedule for the next two weeks appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcoming.map((group) => (
                <Card key={group.date} className="p-5">
                  <h2 className="text-sm font-medium">
                    {formatDate(group.date, actor.locale, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h2>
                  <div className="mt-3">
                    <TaskList tasks={group.tasks} today={today} allowPriority={false} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Inbox ─────────────────────────────────────────────────────── */}
        <TabsContent value="inbox">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <InboxIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-medium">Inbox</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Captured but not scheduled. Use the row menu to move something to today.
            </p>

            {/* No default date here on purpose — the Inbox is where unscheduled
                things live, so a quick-added task stays unscheduled. */}
            <QuickAddTask
              today={today}
              className="mt-4"
              placeholder="Capture something — schedule it later"
            />

            <div className="mt-3">
              <TaskList
                tasks={inbox}
                today={today}
                allowPriority={false}
                emptyTitle="Inbox is empty"
                emptyBody="Anything you capture without a date lands here."
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {day.blocks.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-medium">Today&apos;s blocks</h2>
          <ul className="mt-3 space-y-1">
            {day.blocks.map((block) => (
              <li
                key={block.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
              >
                <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {block.startTime}–{block.endTime}
                </span>
                <span className="min-w-0 flex-1 truncate">{block.title}</span>
                <Badge variant="outline" size="sm">
                  {block.type.toLowerCase()}
                </Badge>
                <DeleteBlockButton blockId={block.id} title={block.title} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

/** Server-action form, so deleting a block needs no client component. */
function DeleteBlockButton({ blockId, title }: { blockId: string; title: string }) {
  async function remove() {
    'use server'
    const { deleteBlockAction } = await import('@/modules/planner/actions')
    await deleteBlockAction({ blockId })
  }

  return (
    <form action={remove}>
      <button
        type="submit"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-danger"
        aria-label={`Delete block ${title}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </form>
  )
}
