/**
 * Mag dit dossier verzonden worden, en door wie?
 *
 * Dit is de technische afdwinging van werkregel 4 en ADR 0005. De verzendlaag
 * roept `decideSubmission` aan en heeft geen andere weg naar buiten: er bestaat
 * geen codepad dat een dossier verstuurt zonder langs deze functie te gaan.
 *
 * Bewust een pure functie zonder database- of netwerktoegang. Daardoor is elke
 * grens hieronder los te testen, en dat is precies wat je wil bij de vraag "gaat
 * er een identiteitskaart de deur uit".
 */

/** Alleen de velden die de beslissing raken. Geen Prisma-type, geen import. */
export interface MunicipalityForSubmission {
  slug: string
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'STALE'
  primaryChannel: 'EMAIL' | 'ONLINE_PORTAL' | 'POST' | 'COUNTER' | null
  submissionEmail: string | null
  postalAddress: string | null
  verifiedAt: Date | null
}

export type SubmissionDecision =
  /** Wij versturen zelf, langs dit kanaal. */
  | { kind: 'SEND_BY_US'; channel: 'EMAIL' | 'POST'; recipient: string }
  /**
   * Wij stellen het dossier samen, de gebruiker dient zelf in. Geen storing:
   * bij een portaal met persoonlijke authenticatie of een fysiek loket hoort
   * dit zo.
   */
  | { kind: 'HAND_TO_USER'; reason: HandToUserReason }

export type HandToUserReason =
  /** Gemeente is niet (meer) geverifieerd. */
  | { code: 'NOT_VERIFIED'; status: 'UNVERIFIED' | 'STALE' }
  /** Verificatie is verlopen op basis van de leeftijd van `verifiedAt`. */
  | { code: 'VERIFICATION_EXPIRED'; verifiedAt: Date; ageInDays: number }
  /** Het kanaal vereist de gebruiker zelf (eID-pincode, IRISbox, loket). */
  | { code: 'CHANNEL_REQUIRES_USER'; channel: 'ONLINE_PORTAL' | 'COUNTER' }
  /** Geen kanaal bekend. */
  | { code: 'NO_CHANNEL' }
  /**
   * Kanaal zegt EMAIL of POST, maar het adres ontbreekt. Dit hoort niet voor te
   * komen — als het toch gebeurt, is het een registryfout en geen reden om te
   * gokken.
   */
  | { code: 'CHANNEL_WITHOUT_ADDRESS'; channel: 'EMAIL' | 'POST' }

export interface SubmissionPolicyOptions {
  /** Na hoeveel dagen een verificatie als verlopen geldt. Default 180. */
  staleAfterDays?: number
  /** Injecteerbaar, zodat de test niet van de systeemklok afhangt. */
  now?: Date
  /**
   * Of wij post zelf versturen. Staat standaard uit: dat is een operationele
   * keuze met kosten die de opdrachtgever nog moet maken (ADR 0005). Zolang hij
   * uit staat, krijgt de gebruiker bij POST een print-klaar dossier.
   */
  weSendPost?: boolean
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function decideSubmission(
  municipality: MunicipalityForSubmission,
  options: SubmissionPolicyOptions = {},
): SubmissionDecision {
  const { staleAfterDays = 180, now = new Date(), weSendPost = false } = options

  // 1. Verificatiestatus. Alles behalve VERIFIED is een halt.
  if (municipality.verificationStatus !== 'VERIFIED') {
    return {
      kind: 'HAND_TO_USER',
      reason: { code: 'NOT_VERIFIED', status: municipality.verificationStatus },
    }
  }

  // 2. Leeftijd van de verificatie. Een entry die ooit VERIFIED werd gezet maar
  //    nooit meer nagekeken is, telt niet als geverifieerd. Dat parking.brussels
  //    in maart 2026 zijn e-mailkanaal sloot, laat zien hoe snel dit veroudert.
  if (!municipality.verifiedAt) {
    return {
      kind: 'HAND_TO_USER',
      reason: { code: 'NOT_VERIFIED', status: 'UNVERIFIED' },
    }
  }

  const ageInDays = Math.floor((now.getTime() - municipality.verifiedAt.getTime()) / DAY_IN_MS)
  if (ageInDays > staleAfterDays) {
    return {
      kind: 'HAND_TO_USER',
      reason: {
        code: 'VERIFICATION_EXPIRED',
        verifiedAt: municipality.verifiedAt,
        ageInDays,
      },
    }
  }

  // 3. Het kanaal.
  switch (municipality.primaryChannel) {
    case 'EMAIL': {
      const recipient = municipality.submissionEmail?.trim()
      if (!recipient) {
        return {
          kind: 'HAND_TO_USER',
          reason: { code: 'CHANNEL_WITHOUT_ADDRESS', channel: 'EMAIL' },
        }
      }
      return { kind: 'SEND_BY_US', channel: 'EMAIL', recipient }
    }

    case 'POST': {
      const recipient = municipality.postalAddress?.trim()
      if (!recipient) {
        return {
          kind: 'HAND_TO_USER',
          reason: { code: 'CHANNEL_WITHOUT_ADDRESS', channel: 'POST' },
        }
      }
      if (!weSendPost) {
        return {
          kind: 'HAND_TO_USER',
          reason: { code: 'CHANNEL_REQUIRES_USER', channel: 'COUNTER' },
        }
      }
      return { kind: 'SEND_BY_US', channel: 'POST', recipient }
    }

    case 'ONLINE_PORTAL':
    case 'COUNTER':
      return {
        kind: 'HAND_TO_USER',
        reason: { code: 'CHANNEL_REQUIRES_USER', channel: municipality.primaryChannel },
      }

    case null:
      return { kind: 'HAND_TO_USER', reason: { code: 'NO_CHANNEL' } }
  }
}

/** Korte, eerlijke uitleg voor de gebruiker. Nooit "binnenkort automatisch". */
export function explainDecision(decision: SubmissionDecision, language: 'NL' | 'FR'): string {
  const nl = language === 'NL'

  if (decision.kind === 'SEND_BY_US') {
    return decision.channel === 'EMAIL'
      ? nl
        ? 'Wij dienen je dossier per e-mail in bij de gemeente.'
        : 'Nous soumettons votre dossier par e-mail à la commune.'
      : nl
        ? 'Wij versturen je dossier per post naar de administratie.'
        : "Nous envoyons votre dossier par courrier à l'administration."
  }

  switch (decision.reason.code) {
    case 'NOT_VERIFIED':
    case 'VERIFICATION_EXPIRED':
      return nl
        ? 'Deze gemeente wordt binnenkort ondersteund. Je krijgt je complete dossier ' +
          'als download, zodat je het zelf kunt indienen.'
        : 'Cette commune sera bientôt prise en charge. Vous recevez votre dossier ' +
          'complet en téléchargement pour le soumettre vous-même.'

    case 'CHANNEL_REQUIRES_USER':
      return nl
        ? 'Deze administratie vraagt dat je zelf indient, met je eigen identiteitskaart. ' +
          'Wij maken je dossier compleet en leggen stap voor stap uit wat je moet doen.'
        : "Cette administration exige que vous soumettiez vous-même, avec votre propre " +
          "carte d'identité. Nous préparons votre dossier complet et vous guidons pas à pas."

    case 'NO_CHANNEL':
    case 'CHANNEL_WITHOUT_ADDRESS':
      return nl
        ? 'We hebben voor deze gemeente nog geen bevestigd indieningsadres. Je krijgt ' +
          'je dossier als download zodat je het zelf kunt indienen.'
        : "Nous n'avons pas encore d'adresse de dépôt confirmée pour cette commune. " +
          'Vous recevez votre dossier en téléchargement.'
  }
}
