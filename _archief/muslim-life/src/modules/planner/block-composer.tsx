'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'

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
import { checkPrayerConflictsAction, createBlockAction } from '@/modules/planner/actions'
import type { PrayerConflict } from '@/server/modules/planner/planner-block.service'
import { durationMinutes, isValidClockTime } from '@/lib/planner/time'

const TYPES = [
  { value: 'FOCUS', label: 'Focus' },
  { value: 'TASK', label: 'Task' },
  { value: 'APPOINTMENT', label: 'Appointment' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'CUSTOM', label: 'Other' },
] as const

/**
 * Create a planner block, with prayer conflicts surfaced before saving.
 *
 * The conflict notice is advisory: every option, including "keep as is", saves
 * the block. A planner that refuses to let someone schedule a meeting is a
 * planner they stop using — and it would also be presuming to tell an adult how
 * to arrange their worship.
 */
export function BlockComposer({ date }: { date: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('FOCUS')
  const [conflicts, setConflicts] = useState<PrayerConflict[]>([])
  const [checked, setChecked] = useState(false)

  const validRange =
    isValidClockTime(startTime) &&
    isValidClockTime(endTime) &&
    durationMinutes(startTime, endTime) > 0

  function reset() {
    setTitle('')
    setStartTime('09:00')
    setEndTime('11:00')
    setType('FOCUS')
    setConflicts([])
    setChecked(false)
  }

  function checkConflicts() {
    if (!validRange) return

    startTransition(async () => {
      const result = await checkPrayerConflictsAction({ localDate: date, startTime, endTime })
      if (result.ok) {
        setConflicts(result.data)
        setChecked(true)
      }
    })
  }

  function save(overrides?: { endTime?: string; startTime?: string }) {
    const finalStart = overrides?.startTime ?? startTime
    const finalEnd = overrides?.endTime ?? endTime

    startTransition(async () => {
      const result = await createBlockAction({
        title: title.trim(),
        localDate: date,
        startTime: finalStart,
        endTime: finalEnd,
        type,
        hadPrayerConflict: conflicts.length > 0,
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success('Block added.')
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validRange || title.trim().length === 0) return

    // Check once, then let the user decide what to do about it.
    if (!checked) {
      checkConflicts()
      return
    }

    save()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus />
          Add block
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a time block</DialogTitle>
          <DialogDescription>
            Blocks sit alongside your prayer times on the timeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="block-title">Title</Label>
            <Input
              id="block-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setChecked(false)
              }}
              placeholder="Deep work — client project"
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start">Starts</Label>
              <Input
                id="block-start"
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value)
                  setChecked(false)
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end">Ends</Label>
              <Input
                id="block-end"
                type="time"
                value={endTime}
                onChange={(event) => {
                  setEndTime(event.target.value)
                  setChecked(false)
                }}
                required
                aria-invalid={!validRange}
              />
            </div>
          </div>

          {!validRange ? (
            <p className="text-xs text-danger">
              A block must end after it starts, on the same day.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>Type</Label>
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

          {checked && conflicts.length > 0 ? (
            <div
              className="space-y-3 rounded-lg border border-border bg-primary-subtle p-3.5"
              role="status"
            >
              <p className="flex items-start gap-2 text-xs leading-relaxed text-primary-subtle-foreground">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  {conflicts.length === 1
                    ? `${conflicts[0]!.prayerLabel} starts during this block at ${conflicts[0]!.at}.`
                    : `${conflicts.length} prayers start during this block.`}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => save({ endTime: conflicts[0]!.endBefore })}
                  disabled={pending}
                >
                  End before {conflicts[0]!.prayerLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => save({ startTime: conflicts[0]!.resumeAfter })}
                  disabled={pending}
                >
                  Continue after
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => save()} disabled={pending}>
                  Keep as is
                </Button>
              </div>
            </div>
          ) : null}

          {checked && conflicts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No prayers fall inside this block.</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!validRange || title.trim().length === 0}>
              {checked ? 'Add block' : 'Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
