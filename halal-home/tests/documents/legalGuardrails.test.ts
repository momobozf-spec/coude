/**
 * De juridische grenzen.
 *
 * Dit is de belangrijkste testsuite van fase 5. Een uitleg die zegt "dit
 * contract is juridisch in orde" is niet een stijlfout maar een uitspraak
 * waarop iemand een handtekening zet.
 */
import { describe, expect, it } from 'vitest'

import {
  assertNoLegalAdvice,
  EXPLANATION_DISCLAIMER,
  EXPLANATION_SYSTEM_PROMPT,
  findLegalAdvice,
  LegalGuardrailError,
} from '@/modules/documents/domain/legalGuardrails'

const safe = {
  summary: 'Dit lijkt een verkoopovereenkomst te zijn, in België meestal het compromis genoemd.',
  keyPoints: ['De opschortende voorwaarde bepaalt wanneer de koop kan vervallen.'],
  attentionPoints: ['Controleer welke termijn er voor je financiering in staat.'],
  questionsForProfessional: ['Is mijn opschortende voorwaarde voldoende ruim geformuleerd?'],
}

const withSummary = (summary: string) => ({ ...safe, summary })

describe('veilige formuleringen komen erdoor', () => {
  it('laat beschrijvende uitleg toe', () => {
    expect(findLegalAdvice(safe)).toHaveLength(0)
    expect(() => assertNoLegalAdvice(safe)).not.toThrow()
  })

  it('laat "lijkt te gaan over" toe', () => {
    expect(
      findLegalAdvice(withSummary('Deze clausule lijkt betrekking te hebben op de financiering.')),
    ).toHaveLength(0)
  })

  it('laat een verwijzing naar de notaris toe', () => {
    expect(
      findLegalAdvice(
        withSummary('Laat je notaris bevestigen wat dit voor jouw situatie betekent.'),
      ),
    ).toHaveLength(0)
  })
})

describe('uitspraken over juridische geldigheid worden geweigerd', () => {
  const forbidden = [
    'Dit contract is juridisch in orde.',
    'De overeenkomst is juridisch correct opgesteld.',
    'Deze clausule is wettelijk geldig.',
    'Het compromis is juridisch waterdicht.',
    'Dit contract is in orde.',
  ]

  it.each(forbidden)('weigert: %s', (summary) => {
    const violations = findLegalAdvice(withSummary(summary))
    expect(violations.length).toBeGreaterThan(0)
  })

  it('gooit met een leesbare reden', () => {
    try {
      assertNoLegalAdvice(withSummary('Dit contract is juridisch in orde.'))
      expect.unreachable('had moeten gooien')
    } catch (error) {
      expect(error).toBeInstanceOf(LegalGuardrailError)
      expect((error as LegalGuardrailError).violations[0]?.reason).toContain('juridische')
    }
  })
})

describe('aansporingen om te tekenen worden geweigerd', () => {
  const forbidden = [
    'Je kan dit gerust ondertekenen.',
    'Je kunt dit veilig tekenen.',
    'Teken dit document.',
    'Je mag dit ondertekenen.',
    'Je moet dit niet tekenen.',
  ]

  it.each(forbidden)('weigert: %s', (summary) => {
    expect(findLegalAdvice(withSummary(summary)).length).toBeGreaterThan(0)
  })
})

describe('advies in eigen naam en garanties worden geweigerd', () => {
  const forbidden = [
    'Ik adviseer je aan om dit te aanvaarden.',
    'Wij raden je af hiermee door te gaan.',
    'Er is geen risico bij deze constructie.',
    'Wij garanderen dat dit klopt.',
    'Je hoeft geen notaris te raadplegen.',
  ]

  it.each(forbidden)('weigert: %s', (summary) => {
    expect(findLegalAdvice(withSummary(summary)).length).toBeGreaterThan(0)
  })
})

describe('elk veld wordt gecontroleerd', () => {
  it('vindt overtredingen in keyPoints', () => {
    const violations = findLegalAdvice({
      ...safe,
      keyPoints: ['Dit contract is juridisch in orde.'],
    })
    expect(violations[0]?.field).toBe('keyPoints[0]')
  })

  it('vindt overtredingen in attentionPoints', () => {
    const violations = findLegalAdvice({
      ...safe,
      attentionPoints: ['Je kan dit veilig ondertekenen.'],
    })
    expect(violations[0]?.field).toBe('attentionPoints[0]')
  })

  it('vindt overtredingen in questionsForProfessional', () => {
    // Ook een "vraag" mag geen verkapt oordeel zijn.
    const violations = findLegalAdvice({
      ...safe,
      questionsForProfessional: ['Dit contract is juridisch in orde, toch?'],
    })
    expect(violations[0]?.field).toBe('questionsForProfessional[0]')
  })

  it('meldt alle overtredingen, niet alleen de eerste', () => {
    const violations = findLegalAdvice({
      summary: 'Dit contract is juridisch in orde.',
      keyPoints: ['Je kan dit veilig tekenen.'],
      attentionPoints: ['Er is geen risico.'],
      questionsForProfessional: [],
    })
    expect(violations.length).toBeGreaterThanOrEqual(3)
  })
})

describe('ontkenningen', () => {
  it('laat een ontkende bewering door', () => {
    // "Wij beoordelen niet of dit juridisch in orde is" zegt het
    // tegenovergestelde van de verboden zin.
    expect(
      findLegalAdvice(
        withSummary('Wij beoordelen niet of dit document juridisch in orde is.'),
      ),
    ).toHaveLength(0)
  })

  it('weigert dezelfde zin zonder ontkenning', () => {
    expect(findLegalAdvice(withSummary('Dit document is juridisch in orde.')).length).toBe(1)
  })

  it('laat "geen" ook als ontkenning gelden', () => {
    expect(
      findLegalAdvice(withSummary('Wij geven geen oordeel of dit juridisch geldig is.')),
    ).toHaveLength(0)
  })

  it('kijkt alleen in een venster vlak vóór de match', () => {
    // De heuristiek is bewust kortzichtig: een "niet" ver weg in de tekst mag
    // een later oordeel niet witwassen.
    const farAway = `Dit is niet ${'x '.repeat(60)}Dit contract is juridisch in orde.`
    expect(findLegalAdvice(withSummary(farAway)).length).toBeGreaterThan(0)
  })
})

describe('de disclaimer', () => {
  it('zegt dat dit geen juridisch advies is', () => {
    expect(EXPLANATION_DISCLAIMER.toLowerCase()).toContain('geen juridisch advies')
  })

  it('zegt dat wij de notaris niet vervangen', () => {
    expect(EXPLANATION_DISCLAIMER.toLowerCase()).toContain('vervangt')
    expect(EXPLANATION_DISCLAIMER.toLowerCase()).toContain('notaris')
  })

  it('overtreedt zijn eigen regels niet', () => {
    // De disclaimer gaat door dezelfde filter: hij mag geen zin bevatten die
    // als advies leest.
    expect(
      findLegalAdvice({
        summary: EXPLANATION_DISCLAIMER,
        keyPoints: [],
        attentionPoints: [],
        questionsForProfessional: [],
      }),
    ).toHaveLength(0)
  })
})

describe('de systeeminstructie', () => {
  it('verbiedt expliciet uitspraken over geldigheid', () => {
    expect(EXPLANATION_SYSTEM_PROMPT.toLowerCase()).toContain('juridisch in orde')
  })

  it('verbiedt expliciet aanraden om te tekenen', () => {
    expect(EXPLANATION_SYSTEM_PROMPT.toLowerCase()).toContain('ondertekenen')
  })

  it('vraagt om vragen voor de notaris', () => {
    expect(EXPLANATION_SYSTEM_PROMPT.toLowerCase()).toContain('notaris')
  })
})

/**
 * ─── DE GRENZEN VAN DE GRENS ─────────────────────────────────────────────────
 *
 * Deze suite legt vast wat het filter NIET tegenhoudt.
 *
 * Dat is geen wenslijst en geen todo. Het is documentatie in uitvoerbare vorm:
 * zolang deze tests groen zijn, weten we precies hoe ver de bescherming reikt.
 * Zou iemand hier "eigenlijk zou dit ook geblokkeerd moeten worden" van maken
 * en de test omdraaien, dan verandert dat niets aan de aard van het filter — er
 * komt één patroon bij, en er blijven er oneindig veel over.
 *
 * Waarom dit expliciet vastgelegd wordt: zonder deze tests groeit vanzelf het
 * idee dat "de guardrail juridisch advies blokkeert". Dat doet hij niet. Hij
 * herkent formuleringen die wij bedacht hebben. Wie op basis van dit bestand
 * beslist hoeveel menselijke review er nodig is, hoort de onderkant te zien en
 * niet alleen de bovenkant.
 */
describe('wat het filter aantoonbaar niet vangt', () => {
  const passes = (summary: string) => expect(findLegalAdvice(withSummary(summary))).toHaveLength(0)

  it('mist een geruststelling zonder de gemarkeerde woorden', () => {
    // Voor een lezer is dit een oordeel over zijn contract. Voor een regex is
    // het een reeks woorden die nergens op de lijst staat.
    passes('Er staat niets in dat je zou tegenhouden.')
  })

  it('mist hetzelfde oordeel in een andere taal', () => {
    // De patronen zijn Nederlands. Een model dat in het Frans of Engels
    // antwoordt, passeert ongehinderd.
    passes('Ce contrat est juridiquement valable.')
    passes('This contract is legally sound, you can sign it.')
  })

  it('mist een oordeel dat over twee zinnen verdeeld staat', () => {
    // Elk patroon kijkt binnen één formulering. Betekenis die pas ontstaat door
    // twee zinnen naast elkaar te zetten, bestaat voor dit filter niet.
    passes('Alles staat er zoals het hoort. Wat mij betreft is er geen enkel bezwaar meer.')
  })

  it('mist een impliciete geruststelling over een clausule', () => {
    passes('Dit is een standaardclausule; daar zit nooit iets achter.')
  })

  it('vangt de bekende formuleringen wél — daar is hij voor', () => {
    // De keerzijde, zodat deze suite niet als "het werkt toch niet" gelezen
    // wordt: binnen zijn bereik doet het filter precies wat het moet doen.
    expect(findLegalAdvice(withSummary('Dit contract is juridisch in orde.')).length).toBeGreaterThan(0)
    expect(findLegalAdvice(withSummary('Je kan dit gerust ondertekenen.')).length).toBeGreaterThan(0)
  })
})
