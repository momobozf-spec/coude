import type { Metadata } from 'next'

import { legalEntity } from '@/config/legal'
import { getRequestLocale } from '@/i18n/server'
import { WithdrawalForm } from '@/modules/billing/withdrawal-form'
import { ConceptNotice, legalLang, type LegalLang } from '../legal-entity-block'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Withdraw from your contract',
  description: 'Withdraw from a Muslim Life Premium purchase within 14 days.',
}

const COPY: Record<LegalLang, { title: string; body: (email: string) => string }> = {
  en: {
    title: 'Withdraw from your contract',
    body: (email) =>
      `You may withdraw from a Premium purchase within 14 days of concluding it, without giving a reason. Use the button below, or send a clear statement to ${email}. Because Premium started immediately at your request, you pay only for the part of the period already provided; the rest is refunded within 14 days.`,
  },
  nl: {
    title: 'Overeenkomst herroepen',
    body: (email) =>
      `Je mag een Premium-aankoop binnen 14 dagen na het afsluiten herroepen zonder opgave van redenen. Gebruik de knop hieronder, of stuur een duidelijke verklaring naar ${email}. Omdat Premium op jouw verzoek meteen startte, betaal je alleen voor het deel van de periode dat al geleverd is; de rest betalen we binnen 14 dagen terug.`,
  },
  fr: {
    title: 'Se rétracter du contrat',
    body: (email) =>
      `Vous pouvez vous rétracter d'un achat Premium dans les 14 jours suivant sa conclusion, sans motif. Utilisez le bouton ci-dessous ou envoyez une déclaration claire à ${email}. Premium ayant commencé immédiatement à votre demande, vous ne payez que la partie de la période déjà fournie ; le reste est remboursé dans les 14 jours.`,
  },
}

/** Online withdrawal function (Directive (EU) 2023/2673). */
export default async function WithdrawalPage() {
  const lang = legalLang(await getRequestLocale())
  const copy = COPY[lang]

  return (
    <article lang={lang} dir="ltr" className="mx-auto max-w-3xl space-y-6 px-5 py-16 text-sm leading-relaxed">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{copy.title}</h1>
        <ConceptNotice lang={lang} />
      </header>
      <p>{copy.body(legalEntity().email)}</p>
      <WithdrawalForm lang={lang} />
    </article>
  )
}
