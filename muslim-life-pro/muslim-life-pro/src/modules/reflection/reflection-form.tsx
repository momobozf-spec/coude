'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Moon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { saveReflectionAction } from '@/modules/reflection/actions'
import type { ReflectionView } from '@/server/modules/reflection/reflection.service'
import { cn } from '@/lib/utils'

const PROMPTS = [
  { key: 'gratitude', label: 'What are you grateful for?', placeholder: 'Alhamdulillah for…' },
  { key: 'wentWell', label: 'What went well today?', placeholder: 'One thing that worked…' },
  {
    key: 'improveTomorrow',
    label: 'What do you want to improve tomorrow?',
    placeholder: 'Tomorrow I will…',
  },
] as const

type PromptKey = (typeof PROMPTS)[number]['key']

/**
 * Evening reflection.
 *
 * Three optional prompts, no scoring, no analysis, no AI. The text stays in the
 * user's own rows — it is never read by analytics and never sent to a provider.
 */
export function ReflectionForm({
  date,
  reflection,
  collapsible = true,
}: {
  date: string
  reflection: ReflectionView | null
  collapsible?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(!collapsible || reflection !== null)

  const [values, setValues] = useState<Record<PromptKey, string>>({
    gratitude: reflection?.gratitude ?? '',
    wentWell: reflection?.wentWell ?? '',
    improveTomorrow: reflection?.improveTomorrow ?? '',
  })

  const filled = Object.values(values).filter((value) => value.trim().length > 0).length
  const saved = reflection !== null

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const result = await saveReflectionAction({
        localDate: date,
        gratitude: values.gratitude,
        wentWell: values.wentWell,
        improveTomorrow: values.improveTomorrow,
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success('Reflection saved.')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Card className="p-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 text-start"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Moon className="size-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Tonight</span>
            <span className="block text-xs text-muted-foreground">
              Daily reflection · three short prompts
            </span>
          </span>
          <span className="text-xs font-medium text-primary">Open</span>
        </button>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Moon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Daily reflection</h2>
          <p className="text-xs text-muted-foreground">
            {saved ? `Saved · ${filled} of 3 answered` : 'Private to you. Answer what you like.'}
          </p>
        </div>
        {saved ? (
          <Check className="size-4 shrink-0 text-primary" aria-label="Saved" />
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {PROMPTS.map((prompt) => (
          <div key={prompt.key} className="space-y-1.5">
            <Label htmlFor={`reflection-${prompt.key}`}>{prompt.label}</Label>
            <Textarea
              id={`reflection-${prompt.key}`}
              value={values[prompt.key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [prompt.key]: event.target.value }))
              }
              placeholder={prompt.placeholder}
              rows={2}
              maxLength={2000}
              className={cn('min-h-16 resize-none')}
            />
          </div>
        ))}

        <div className="flex items-center justify-end gap-3">
          {collapsible ? (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          ) : null}
          <Button type="submit" loading={pending}>
            Save reflection
          </Button>
        </div>
      </form>
    </Card>
  )
}
