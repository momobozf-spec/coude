'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { createHabitAction, createHabitFromTemplateAction } from '@/modules/habits/actions'
import type { HabitTemplate } from '@/server/modules/habits/habit-templates'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'WORSHIP', label: 'Worship' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'LEARNING', label: 'Learning' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'WORK', label: 'Work' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'PERSONAL', label: 'Personal' },
] as const

const FREQUENCIES = [
  { value: 'DAILY', label: 'Every day' },
  { value: 'SPECIFIC_DAYS', label: 'Certain days' },
  { value: 'TIMES_PER_WEEK', label: 'A number of times a week' },
] as const

const TYPES = [
  { value: 'BOOLEAN', label: 'Done or not done' },
  { value: 'COUNTER', label: 'Count (pages, glasses…)' },
  { value: 'DURATION', label: 'Minutes' },
] as const

const WEEKDAYS = [
  { value: 1, short: 'M' },
  { value: 2, short: 'T' },
  { value: 3, short: 'W' },
  { value: 4, short: 'T' },
  { value: 5, short: 'F' },
  { value: 6, short: 'S' },
  { value: 0, short: 'S' },
] as const

interface HabitComposerProps {
  groups: { key: string; label: string; templates: HabitTemplate[] }[]
  /** Template keys the user already has, so they are not offered twice. */
  existingTemplateKeys: string[]
  atLimit: boolean
  limit: number | null
}

export function HabitComposer({
  groups,
  existingTemplateKeys,
  atLimit,
  limit,
}: HabitComposerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('PERSONAL')
  const [frequencyType, setFrequencyType] =
    useState<(typeof FREQUENCIES)[number]['value']>('DAILY')
  const [targetPerPeriod, setTargetPerPeriod] = useState(3)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5])
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('BOOLEAN')
  const [targetValue, setTargetValue] = useState(1)
  const [unit, setUnit] = useState('')

  function done(message: string) {
    toast.success(message)
    setOpen(false)
    setName('')
    router.refresh()
  }

  function addTemplate(templateKey: string) {
    startTransition(async () => {
      const result = await createHabitFromTemplateAction({ templateKey })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      done('Habit added.')
    })
  }

  function submitCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const result = await createHabitAction({
        name: name.trim(),
        category,
        type,
        targetValue: type === 'BOOLEAN' ? 1 : targetValue,
        unit: type === 'BOOLEAN' ? null : unit.trim() || null,
        frequencyType,
        targetPerPeriod: frequencyType === 'TIMES_PER_WEEK' ? targetPerPeriod : 1,
        daysOfWeek: frequencyType === 'SPECIFIC_DAYS' ? daysOfWeek : [],
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }
      done('Habit created.')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add habit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a habit</DialogTitle>
          <DialogDescription>
            Start from a template or build your own. Nothing is created until you choose it.
          </DialogDescription>
        </DialogHeader>

        {atLimit ? (
          <div className="rounded-lg border border-border bg-primary-subtle p-4">
            <p className="flex items-start gap-2 text-sm text-primary-subtle-foreground">
              <Sparkles className="mt-px size-4 shrink-0" aria-hidden />
              <span>
                You&apos;re tracking all {limit} habits included in the free plan. Premium removes
                the limit — prayers never count towards it.
              </span>
            </p>
            <Button size="sm" className="mt-3" asChild>
              <Link href="/pricing">See Premium</Link>
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="templates">
            <TabsList className="w-full">
              <TabsTrigger value="templates" className="flex-1">
                Templates
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates">
              <div className="max-h-96 space-y-5 overflow-y-auto scrollbar-subtle pe-1">
                {groups.map((group) => (
                  <div key={group.key}>
                    <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h3>
                    <div className="mt-2 space-y-1.5">
                      {group.templates.map((template) => {
                        const already = existingTemplateKeys.includes(template.key)
                        return (
                          <button
                            key={template.key}
                            type="button"
                            disabled={already || pending}
                            onClick={() => addTemplate(template.key)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors',
                              already
                                ? 'cursor-not-allowed border-border bg-muted opacity-60'
                                : 'border-border bg-surface hover:border-border-strong hover:bg-muted',
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {template.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {template.description}
                              </span>
                            </span>
                            {already ? (
                              <Badge variant="default" size="sm">
                                Added
                              </Badge>
                            ) : (
                              <Plus className="size-4 shrink-0 text-muted-foreground" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom">
              <form onSubmit={submitCustom} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="habit-name">Name</Label>
                  <Input
                    id="habit-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Walk after Maghrib"
                    maxLength={120}
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={category}
                      onValueChange={(value) => setCategory(value as typeof category)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>How to track it</Label>
                    <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {type !== 'BOOLEAN' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="habit-target">Daily target</Label>
                      <Input
                        id="habit-target"
                        type="number"
                        min={1}
                        max={10000}
                        value={targetValue}
                        onChange={(event) => setTargetValue(Number(event.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="habit-unit">Unit</Label>
                      <Input
                        id="habit-unit"
                        value={unit}
                        onChange={(event) => setUnit(event.target.value)}
                        placeholder={type === 'DURATION' ? 'minutes' : 'pages'}
                        maxLength={24}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select
                    value={frequencyType}
                    onValueChange={(value) => setFrequencyType(value as typeof frequencyType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {frequencyType === 'SPECIFIC_DAYS' ? (
                  <div className="space-y-1.5">
                    <Label>Which days</Label>
                    <div className="flex gap-1.5" role="group" aria-label="Days of the week">
                      {WEEKDAYS.map((weekday, index) => {
                        const active = daysOfWeek.includes(weekday.value)
                        return (
                          <button
                            key={`${weekday.value}-${index}`}
                            type="button"
                            aria-pressed={active}
                            aria-label={`Day ${weekday.value}`}
                            onClick={() =>
                              setDaysOfWeek((current) =>
                                current.includes(weekday.value)
                                  ? current.filter((day) => day !== weekday.value)
                                  : [...current, weekday.value],
                              )
                            }
                            className={cn(
                              'size-9 rounded-lg border text-xs font-medium transition-colors',
                              active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-surface text-muted-foreground hover:border-border-strong',
                            )}
                          >
                            {weekday.short}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {frequencyType === 'TIMES_PER_WEEK' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="habit-per-week">Times per week</Label>
                    <Input
                      id="habit-per-week"
                      type="number"
                      min={1}
                      max={7}
                      value={targetPerPeriod}
                      onChange={(event) => setTargetPerPeriod(Number(event.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      You choose which days. It will never be shown as missed on the others.
                    </p>
                  </div>
                ) : null}

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending} disabled={name.trim().length === 0}>
                    Create habit
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
