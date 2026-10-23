'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { quickAddTaskAction } from '@/modules/planner/actions'
import { parseQuickAdd } from '@/lib/planner/quick-add'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * One-line task capture.
 *
 * The same deterministic parser runs on the client purely to show a live preview
 * of what will be created; the server re-parses the raw text and is the authority.
 * Nothing is inferred twice into two different results.
 */
export function QuickAddTask({
  today,
  defaultDate,
  className,
  placeholder = 'Add a task — try “Call accountant tomorrow at 10:00”',
}: {
  today: string
  /** When provided, an unparsed task lands on this day instead of the Inbox. */
  defaultDate?: string
  className?: string
  placeholder?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()

  const preview = text.trim().length > 1 ? parseQuickAdd(text, today) : null
  const showsPreview = Boolean(preview && (preview.scheduledDate || preview.priority !== 'NORMAL'))

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = text.trim()
    if (value.length === 0) return

    startTransition(async () => {
      const result = await quickAddTaskAction({
        text: value,
        today,
        // When the text implies no date, the server falls back to this day, so a
        // task typed on Today lands on today while the Inbox stays unscheduled.
        defaultDate: defaultDate ?? null,
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      setText('')
      inputRef.current?.focus()
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          maxLength={300}
          aria-label="Add a task"
          disabled={pending}
        />
        <Button type="submit" size="icon" loading={pending} aria-label="Add task">
          {pending ? null : <Plus />}
        </Button>
      </div>

      {showsPreview && preview ? (
        <p className="ps-1 text-xs text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{preview.title}</span>
          {preview.scheduledDate ? (
            <>
              {' · '}
              {formatDate(preview.scheduledDate, 'en', { weekday: 'short', day: 'numeric', month: 'short' })}
            </>
          ) : null}
          {preview.scheduledTime ? ` · ${preview.scheduledTime}` : null}
          {preview.priority !== 'NORMAL' ? ` · ${preview.priority.toLowerCase()} priority` : null}
        </p>
      ) : null}
    </form>
  )
}
