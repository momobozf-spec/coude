'use client'

import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useIsMounted } from '@/lib/hooks/use-client-state'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
  { value: 'system', labelKey: 'theme.system', icon: Monitor },
] as const

export function AppearanceSetting() {
  const { theme, setTheme } = useTheme()
  const mounted = useIsMounted()

  // The resolved theme is unknowable on the server, so the control is deferred
  // rather than rendered with a guessed selection that then jumps.
  if (!mounted) return <Skeleton className="h-24 w-full" />

  return (
    <Card className="p-4">
      <div
        className="grid gap-2.5 sm:grid-cols-3"
        role="radiogroup"
        aria-label={t('theme.label')}
      >
        {OPTIONS.map((option) => {
          const active = theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3.5 text-start transition-colors',
                active
                  ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                  : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <option.icon className="size-4 shrink-0" />
              <span className="text-sm font-medium">{t(option.labelKey as never)}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
