'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { CATALOGUES } from '@/i18n'
import { siteConfig, type Locale } from '@/config/site'
import { updateLocaleAction } from '@/modules/settings/actions'
import { cn } from '@/lib/utils'

/**
 * Language picker.
 *
 * Each unreviewed language says so, in that language, before it is chosen and
 * again after. A member picking Arabic deserves to know the wording came from a
 * machine — particularly here, where the interface uses religious vocabulary
 * that a bad translation could render wrong rather than merely awkward.
 */
export function LanguageSetting({ current }: { current: string }) {
  const [selected, setSelected] = useState<Locale>(
    (siteConfig.locales as readonly string[]).includes(current)
      ? (current as Locale)
      : siteConfig.defaultLocale,
  )
  const [pending, startTransition] = useTransition()

  function choose(locale: Locale) {
    if (locale === selected) return
    const previous = selected
    setSelected(locale)

    startTransition(async () => {
      const result = await updateLocaleAction({ locale })
      if (!result.ok) {
        setSelected(previous)
        toast.error(result.message)
        return
      }
      // The document's `lang` and `dir` are set by the root layout, so the whole
      // tree has to re-render from the server for a direction change to apply.
      window.location.reload()
    })
  }

  const info = CATALOGUES[selected]

  return (
    <Card className="space-y-4 p-4">
      <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Language">
        {siteConfig.locales.map((locale) => {
          const catalogue = CATALOGUES[locale]
          const active = selected === locale

          return (
            <button
              key={locale}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => choose(locale)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-start transition',
                active
                  ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                  : 'border-border hover:border-border-strong hover:bg-muted',
              )}
            >
              <span className="min-w-0">
                <span
                  className="block truncate text-sm font-medium"
                  lang={locale}
                  dir={catalogue.dir}
                >
                  {catalogue.nativeName}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {catalogue.status === 'machine-unreviewed' ? 'Machine translation' : catalogue.name}
                </span>
              </span>

              {active && pending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : active ? (
                <Check className="size-4 shrink-0" />
              ) : null}
            </button>
          )
        })}
      </div>

      {info.status === 'machine-unreviewed' ? (
        <p
          className="flex items-start gap-2 rounded-lg bg-warning-subtle p-3 text-xs leading-relaxed"
          role="note"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            This language was machine-translated and is waiting for a native speaker to check it.
            Wording may be wrong or unnatural. English remains the reference.
          </span>
        </p>
      ) : null}
    </Card>
  )
}
