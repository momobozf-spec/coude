'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { withdrawalAction } from '@/modules/billing/withdrawal-actions'

/**
 * Online withdrawal function (Directive (EU) 2023/2673): a clearly labelled
 * button, a short statement (name + the account's e-mail, which identifies the
 * Premium contract and receives the acknowledgement) and a separate confirm
 * button. No pre-ticked boxes, no bundled consents.
 */
const TEXT = {
  en: {
    open: 'Withdraw from contract here',
    intro: 'Withdraw from your Muslim Life Premium contract. You will receive an acknowledgement by e-mail.',
    name: 'Name',
    email: 'E-mail address of your account',
    confirm: 'Confirm withdrawal',
    done: 'Your withdrawal was received on',
    mailed: 'We e-mailed you an acknowledgement.',
    notMailed: 'The acknowledgement e-mail could not be sent; keep this page or e-mail us.',
  },
  nl: {
    open: 'Hier de overeenkomst herroepen',
    intro: 'Herroep je overeenkomst voor Muslim Life Premium. Je krijgt een ontvangstbevestiging per e-mail.',
    name: 'Naam',
    email: 'E-mailadres van je account',
    confirm: 'Herroeping bevestigen',
    done: 'Je herroeping is ontvangen op',
    mailed: 'We hebben je een ontvangstbevestiging gemaild.',
    notMailed: 'De bevestigingsmail kon niet verstuurd worden; bewaar deze pagina of mail ons.',
  },
  fr: {
    open: 'Se rétracter du contrat ici',
    intro: 'Rétractez-vous de votre contrat Muslim Life Premium. Vous recevrez un accusé de réception par e-mail.',
    name: 'Nom',
    email: 'Adresse e-mail de votre compte',
    confirm: 'Confirmer la rétractation',
    done: 'Votre rétractation a été reçue le',
    mailed: 'Nous vous avons envoyé un accusé de réception par e-mail.',
    notMailed: "L'e-mail de confirmation n'a pas pu être envoyé ; conservez cette page ou écrivez-nous.",
  },
} as const

export function WithdrawalForm({ lang }: { lang: 'en' | 'nl' | 'fr' }) {
  const t = TEXT[lang]
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ receivedAt: string; acknowledged: boolean } | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('confirm', 'true')
    setError(null)
    startTransition(async () => {
      const res = await withdrawalAction(formData)
      if (res.ok) setResult(res.data)
      else setError(res.message)
    })
  }

  if (result) {
    const when = new Date(result.receivedAt).toLocaleString(lang === 'en' ? 'en-GB' : `${lang}-BE`, {
      timeZone: 'Europe/Brussels',
    })
    return (
      <div role="status" className="rounded-xl border border-border bg-surface-sunken p-5 text-sm">
        <p className="font-medium">
          {t.done} {when}.
        </p>
        <p className="mt-2 text-muted-foreground">{result.acknowledged ? t.mailed : t.notMailed}</p>
      </div>
    )
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{t.open}</Button>
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border p-5">
      <p className="text-muted-foreground">{t.intro}</p>
      <div className="space-y-1.5">
        <Label htmlFor="withdrawal-name">{t.name}</Label>
        <Input id="withdrawal-name" name="name" required maxLength={120} autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="withdrawal-email">{t.email}</Label>
        <Input id="withdrawal-email" name="email" type="email" required maxLength={254} autoComplete="email" />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" loading={pending}>
        {t.confirm}
      </Button>
    </form>
  )
}
