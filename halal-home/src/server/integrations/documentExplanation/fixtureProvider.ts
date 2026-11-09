/**
 * Uitleg zonder AI.
 *
 * ─── WAAROM DIT GEEN NOODOPLOSSING IS ────────────────────────────────────────
 *
 * Deze provider levert redactionele uitleg per documentsoort: waarvoor het
 * document dient, waar mensen doorgaans op letten, en welke vragen zinnig zijn
 * voor de notaris. Dat is minder specifiek dan uitleg over de werkelijke tekst,
 * maar het is wél juist — en voor de meeste documenten is "waar dient dit voor
 * en wat vraag ik ernaar" precies wat iemand nodig heeft.
 *
 * Hij bestaat om drie redenen:
 *   1. de hele flow is te draaien en te testen zonder credentials;
 *   2. als het model uitvalt, blijft de functie werken;
 *   3. de tekst is nagelezen door een mens, wat van gegenereerde tekst niet
 *      gezegd kan worden.
 *
 * De UI toont dat dit vaste uitleg is en geen analyse van het bestand. Doen
 * alsof een fixture het document gelezen heeft, zou de gebruiker misleiden.
 */
import 'server-only'
import { DocumentCategory } from '@prisma/client'

import {
  EXPLANATION_DISCLAIMER,
  EXPLANATION_VERSION,
} from '@/modules/documents/domain/legalGuardrails'
import type {
  DocumentExplanation,
  DocumentExplanationProvider,
  ExplanationInput,
} from '@/types/documentExplanation'

interface CategoryTemplate {
  summary: string
  keyPoints: string[]
  attentionPoints: string[]
  questionsForProfessional: string[]
}

/**
 * Redactionele uitleg per categorie, toegespitst op de Belgische praktijk.
 *
 * Let op de formuleringen: overal "doorgaans", "meestal", "laat bevestigen".
 * Geen enkele zin stelt vast wat er in het dossier van déze gebruiker geldt.
 */
const TEMPLATES: Partial<Record<DocumentCategory, CategoryTemplate>> = {
  PURCHASE_AGREEMENT: {
    summary:
      'Dit lijkt een verkoopovereenkomst te zijn — in België meestal het compromis genoemd. ' +
      'Zo’n overeenkomst legt de verkoop vast tussen koper en verkoper, nog vóór de notariële akte. ' +
      'Vanaf de ondertekening zijn beide partijen in principe gebonden.',
    keyPoints: [
      'Het compromis bindt doorgaans al vóór de akte bij de notaris. De akte maakt de overdracht officieel tegenover derden.',
      'De opschortende voorwaarden bepalen wanneer de koop alsnog kan vervallen — bijvoorbeeld als je financiering niet rondkomt.',
      'Er staat meestal een termijn in waarbinnen je je financiering rond moet hebben.',
      'Het voorschot bedraagt in de praktijk vaak 5 tot 10 %, doorgaans op de derdenrekening van de notaris.',
    ],
    attentionPoints: [
      'Controleer of er een opschortende voorwaarde voor je financiering in staat, en welke termijn daarbij hoort.',
      'Kijk na welke attesten de verkoper moet leveren en tegen wanneer: EPC, bodemattest, keuring elektriciteit.',
      'Let op afspraken over wat er blijft en wat de verkoper meeneemt.',
      'Noteer de afgesproken datum van de akte en van de sleuteloverdracht.',
    ],
    questionsForProfessional: [
      'Is de opschortende voorwaarde voor mijn financiering voldoende ruim geformuleerd?',
      'Wat gebeurt er precies als ik de termijn voor mijn financiering niet haal?',
      'Welke attesten ontbreken nog, en wie moet ze aanleveren?',
      'Zijn er clausules die ongebruikelijk zijn voor dit soort verkoop?',
    ],
  },

  NOTARY: {
    summary:
      'Dit lijkt een notarisdocument te zijn. De notaris bereidt de authentieke akte voor, ' +
      'controleert de eigendomstitel en de stedenbouwkundige toestand, en zorgt voor de registratie ' +
      'van de eigendomsoverdracht.',
    keyPoints: [
      'De authentieke akte maakt de eigendomsoverdracht officieel tegenover derden.',
      'De notaris controleert onder meer de eigendomstitel, hypothecaire lasten en stedenbouwkundige inlichtingen.',
      'Registratierechten en notariskosten worden bij de akte afgerekend.',
      'Je mag altijd je eigen notaris aanstellen; dat kost je in de regel niets extra.',
    ],
    attentionPoints: [
      'Controleer of je naam, adres en burgerlijke staat correct vermeld staan.',
      'Kijk of de omschrijving van het pand klopt met wat je koopt, inclusief eventuele bijgebouwen.',
      'Ga na welke bedragen wanneer op de rekening van de notaris moeten staan.',
    ],
    questionsForProfessional: [
      'Welke documenten heb je nog van mij nodig, en tegen wanneer?',
      'Zijn er lasten of erfdienstbaarheden op dit pand die ik moet kennen?',
      'Wat is de volledige afrekening, en welk bedrag moet wanneer overgemaakt zijn?',
      'Wat gebeurt er als de akte niet op de geplande datum kan doorgaan?',
    ],
  },

  FINANCING: {
    summary:
      'Dit lijkt een financieringsdocument te zijn: een aanbod, een simulatie of een bevestiging ' +
      'van een aanbieder over wat je kan financieren en onder welke voorwaarden.',
    keyPoints: [
      'Kijk of het om een simulatie gaat of om een bindend aanbod — dat verschil is groot.',
      'De looptijd en de periodieke betaling bepalen samen wat je in totaal betaalt.',
      'Eenmalige kosten zoals dossierkosten staan meestal los van het periodieke bedrag.',
      'Bij een islamitische financieringsvorm beschrijft het document een constructie (bijvoorbeeld murabaha of een afnemend partnerschap), geen lening met rente.',
    ],
    attentionPoints: [
      'Controleer tot wanneer het aanbod geldig is.',
      'Kijk welke voorwaarden er nog gelden voordat het definitief wordt.',
      'Ga na of de vermelde eigen inbreng overeenkomt met wat je werkelijk beschikbaar hebt.',
      'Let op wat er gebeurt bij vervroegde terugbetaling.',
    ],
    questionsForProfessional: [
      'Is dit een bindend aanbod of een simulatie?',
      'Welke kosten komen er nog bij die niet in dit document staan?',
      'Wat gebeurt er als ik vervroegd wil terugbetalen?',
      'Welke zekerheden vraagt u, en wat betekent dat concreet?',
    ],
  },

  PROPERTY: {
    summary:
      'Dit lijkt een document over de woning zelf te zijn — bijvoorbeeld een EPC, een bodemattest ' +
      'of een keuringsverslag. Zulke attesten beschrijven de toestand van het pand op het moment ' +
      'van de vaststelling.',
    keyPoints: [
      'Een EPC toont hoe energiezuinig de woning is, met een label en een kengetal in kWh/m² per jaar.',
      'Een bodemattest zegt of de grond bekend staat als verontreinigd.',
      'Een keuringsverslag elektriciteit kan positief of negatief zijn; bij negatief geldt doorgaans een hersteltermijn.',
      'Attesten hebben een datum en soms een geldigheidsduur.',
    ],
    attentionPoints: [
      'Controleer de datum: een oud attest beschrijft een oude toestand.',
      'Kijk of het adres en de kadastrale gegevens overeenkomen met het pand dat je koopt.',
      'Bij een negatief keuringsverslag: ga na binnen welke termijn herstel moet gebeuren en wie dat betaalt.',
    ],
    questionsForProfessional: [
      'Is dit attest nog geldig op de datum van de akte?',
      'Wat betekent dit verslag concreet voor mijn verplichtingen na de aankoop?',
      'Zijn er attesten die nog ontbreken in dit dossier?',
    ],
  },

  IDENTITY: {
    summary:
      'Dit lijkt een identiteitsdocument te zijn. Zowel je financier als je notaris vraagt hierom ' +
      'om je identiteit vast te stellen.',
    keyPoints: [
      'De notaris is wettelijk verplicht je identiteit te controleren.',
      'Meestal zijn beide zijden van de identiteitskaart nodig.',
      'Bij een aankoop met meerdere kopers is het document van elke koper nodig.',
    ],
    attentionPoints: [
      'Controleer of het document nog geldig is op de datum van de akte.',
      'Zorg dat de gegevens leesbaar zijn op de scan.',
    ],
    questionsForProfessional: [
      'Welke identiteitsdocumenten heb je precies nodig, en van wie?',
      'Moet ik ze in origineel meebrengen naar de afspraak?',
    ],
  },

  INCOME: {
    summary:
      'Dit lijkt een inkomensdocument te zijn. Financieringsaanbieders gebruiken zulke documenten ' +
      'om te beoordelen wat je maandelijks kan dragen.',
    keyPoints: [
      'Doorgaans vragen aanbieders de laatste drie loonfiches, of bij zelfstandigen de recentste aanslagbiljetten.',
      'Vaste en variabele inkomsten worden meestal verschillend gewogen.',
      'Lopende kredieten tellen mee in de beoordeling.',
    ],
    attentionPoints: [
      'Controleer of de periode klopt met wat de aanbieder vroeg.',
      'Zorg dat alle pagina’s leesbaar zijn.',
    ],
    questionsForProfessional: [
      'Welke periode moeten mijn inkomensdocumenten precies dekken?',
      'Hoe weegt u variabele inkomsten of premies mee?',
    ],
  },

  INSURANCE: {
    summary:
      'Dit lijkt een verzekeringsdocument te zijn. Bij een woningaankoop gaat het meestal om de ' +
      'brandverzekering, die in orde moet zijn vanaf de dag van de akte.',
    keyPoints: [
      'Vrijwel elke financier maakt een brandverzekering verplicht.',
      'De dekking moet ingaan op of vóór de datum van de akte.',
      'De polis vermeldt wat gedekt is en welke vrijstelling geldt.',
    ],
    attentionPoints: [
      'Controleer de ingangsdatum: tussen de akte en de eerste polisdag ben je onverzekerd eigenaar.',
      'Kijk of het verzekerde bedrag past bij de woning.',
    ],
    questionsForProfessional: [
      'Vanaf welke datum loopt mijn dekking precies?',
      'Welke schade valt buiten deze polis?',
    ],
  },
}

/** Voor categorieën zonder eigen tekst. Eerlijk over wat het niet weet. */
const GENERIC: CategoryTemplate = {
  summary:
    'Voor dit type document hebben we nog geen specifieke uitleg. Bewaar het bij je dossier en ' +
    'leg het voor aan je notaris of je financieringsadviseur wanneer je twijfelt.',
  keyPoints: [
    'Bewaar documenten bij het dossier waar ze bij horen, zodat je ze terugvindt wanneer erom gevraagd wordt.',
    'Noteer van wie je het document kreeg en wanneer.',
  ],
  attentionPoints: [
    'Controleer of de datum en je gegevens kloppen.',
    'Vraag na tegen wanneer dit document nodig is.',
  ],
  questionsForProfessional: [
    'Waarvoor heb je dit document precies nodig?',
    'Is dit document nog geldig op het moment dat we het nodig hebben?',
  ],
}

export class FixtureExplanationProvider implements DocumentExplanationProvider {
  readonly name = 'fixture'

  /** Voor elke categorie is er uitleg — desnoods de generieke. */
  supports(): boolean {
    return true
  }

  explain(input: ExplanationInput): Promise<DocumentExplanation> {
    const template = TEMPLATES[input.category] ?? GENERIC

    return Promise.resolve({
      ...template,
      disclaimer: EXPLANATION_DISCLAIMER,
      source: 'FIXTURE',
      provider: this.name,
      model: null,
      version: EXPLANATION_VERSION,
      sourceChecksum: input.sourceChecksum ?? null,
    })
  }
}

export { TEMPLATES as FIXTURE_TEMPLATES, GENERIC as GENERIC_TEMPLATE }
