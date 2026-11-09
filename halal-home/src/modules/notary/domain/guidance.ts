/**
 * Begeleiding bij het notariële traject.
 *
 * ─── WAT DEZE MODULE WÉL DOET ────────────────────────────────────────────────
 *
 * Uitleggen wat er gebeurt, welke documenten er doorgaans nodig zijn, waar
 * mensen op letten, en welke vragen zinnig zijn om te stellen. Dat is
 * voorbereiding, en goede voorbereiding scheelt weken vertraging.
 *
 * ─── WAT ZE NIET DOET ────────────────────────────────────────────────────────
 *
 * Halal Home verstrekt geen notariële of juridische goedkeuring, controleert
 * geen akte, en beoordeelt geen dossier. De notaris doet dat, en die is
 * wettelijk aansprakelijk voor die beoordeling — wij niet.
 *
 * Dat onderscheid zit in de STRUCTUUR van dit bestand, niet alleen in de
 * toon: elk blok is expliciet getypeerd als `information`, `preparation`,
 * `attention` of `question`. Er bestaat geen categorie "oordeel" of
 * "goedkeuring", dus die kan er ook niet insluipen.
 *
 * ─── VERANDERLIJKE INHOUD ────────────────────────────────────────────────────
 *
 * Tarieven en termijnen staan hier NIET. Registratierechten zitten in
 * `CostRule` met een geldigheidsvenster; de documentenlijst zit in
 * `ChecklistTemplate` met versie en bron. Wat hier staat is de gang van zaken,
 * en die wijzigt zelden. Waar een termijn wel genoemd wordt, staat er
 * "doorgaans" bij — het is dan een verwachting, geen norm.
 */

/**
 * Het soort informatie. Bewust geen `judgement` of `approval`: die bestaan niet
 * en kunnen er dus niet komen.
 */
export type GuidanceKind = 'information' | 'preparation' | 'attention' | 'question'

export interface GuidanceBlock {
  key: string
  kind: GuidanceKind
  title: string
  body: string
}

export interface NotaryPhase {
  key: string
  title: string
  /** Eén zin: wat gebeurt er in deze stap? */
  summary: string
  blocks: GuidanceBlock[]
}

/** Het Belgische notariële traject, in drie stappen. */
export const BE_NOTARY_PHASES: readonly NotaryPhase[] = [
  {
    key: 'before',
    title: 'Voor de afspraak',
    summary:
      'De notaris verzamelt de documenten en voert de wettelijke opzoekingen uit. Hoe vollediger je dossier, hoe minder kans op uitstel.',
    blocks: [
      {
        key: 'before.role',
        kind: 'information',
        title: 'Wat de notaris doet',
        body:
          'De notaris controleert de eigendomstitel, vraagt stedenbouwkundige inlichtingen op, gaat na of er hypothecaire lasten of erfdienstbaarheden op het pand rusten, en bereidt de authentieke akte voor. Hij is bij wet verplicht beide partijen te informeren, ook als je hem zelf hebt aangesteld.',
      },
      {
        key: 'before.own_notary',
        kind: 'information',
        title: 'Je mag je eigen notaris kiezen',
        body:
          'Koper en verkoper mogen elk een eigen notaris aanstellen. De erelonen worden dan onder hen verdeeld; het kost jou in de regel niets extra. Vraag het na als je twijfelt.',
      },
      {
        key: 'before.documents',
        kind: 'preparation',
        title: 'Leg je documenten klaar',
        body:
          'Identiteitsdocumenten van alle kopers, de getekende verkoopovereenkomst, je financieringsbewijs en de gegevens van je brandverzekering. Het volledige overzicht staat in je checklist hieronder.',
      },
      {
        key: 'before.timing',
        kind: 'attention',
        title: 'De termijn tussen compromis en akte',
        body:
          'Tussen het compromis en de akte zit doorgaans enkele maanden. Die tijd is nodig voor de opzoekingen. Loopt er iets vertraging op, meld dat vroeg — een akte verzetten terwijl je verhuis al geboekt is, is duur.',
      },
    ],
  },
  {
    key: 'deed',
    title: 'De akte',
    summary:
      'Bij de ondertekening wordt de eigendom overgedragen en worden de bedragen afgerekend.',
    blocks: [
      {
        key: 'deed.what',
        kind: 'information',
        title: 'Wat de authentieke akte is',
        body:
          'De authentieke akte maakt de eigendomsoverdracht officieel tegenover derden. Het compromis bond je al tegenover de verkoper; de akte maakt het tegenover iedereen geldig en zorgt voor de registratie.',
      },
      {
        key: 'deed.funds',
        kind: 'preparation',
        title: 'Het geld moet op tijd bij de notaris staan',
        body:
          'Het volledige bedrag — aankoopprijs, registratierechten, erelonen en aktekosten — moet doorgaans enkele dagen vóór de ondertekening op de derdenrekening van de notaris staan. Vraag tijdig om de exacte afrekening en de uiterste datum.',
      },
      {
        key: 'deed.insurance',
        kind: 'attention',
        title: 'Je brandverzekering moet lopen',
        body:
          'De dekking hoort in te gaan op of vóór de dag van de akte. Tussen de ondertekening en je eerste polisdag ben je onverzekerd eigenaar.',
      },
      {
        key: 'deed.read',
        kind: 'attention',
        title: 'Lees de akte vóór de afspraak',
        body:
          'Vraag de ontwerpakte enkele dagen op voorhand op. Onduidelijkheden bespreek je liever thuis dan aan tafel met de verkoper erbij.',
      },
    ],
  },
  {
    key: 'after',
    title: 'Na de akte',
    summary: 'De administratie na de overdracht: nutsvoorzieningen, adres en belastingen.',
    blocks: [
      {
        key: 'after.utilities',
        kind: 'preparation',
        title: 'Nutsvoorzieningen op je naam',
        body:
          'Water, gas en elektriciteit gaan niet automatisch mee over. Noteer de meterstanden bij de sleuteloverdracht, samen met de verkoper, en fotografeer ze.',
      },
      {
        key: 'after.address',
        kind: 'preparation',
        title: 'Adreswijziging',
        body:
          'Meld je verhuis bij de gemeente. In België geldt daarvoor doorgaans een korte termijn na de effectieve verhuis; vraag na wat er in jouw gemeente geldt.',
      },
      {
        key: 'after.tax',
        kind: 'information',
        title: 'Onroerende voorheffing',
        body:
          'Als eigenaar krijg je jaarlijks een aanslag onroerende voorheffing. Die volgt na de aankoop en staat los van de registratierechten die je bij de akte betaalde.',
      },
      {
        key: 'after.deed_copy',
        kind: 'information',
        title: 'Je afschrift van de akte',
        body:
          'De notaris bezorgt je later een afschrift. Bewaar dat bij je dossier: je hebt het nodig bij een latere verkoop of verbouwing.',
      },
    ],
  },
]

/**
 * Vragen die de gebruiker aan zijn notaris kan stellen.
 *
 * Bewust een aparte lijst en geen onderdeel van de uitleg: dit is het moment
 * waarop het platform de gebruiker naar de professional stuurt in plaats van
 * zelf antwoord te geven.
 */
export const QUESTIONS_FOR_NOTARY: readonly { key: string; question: string; why: string }[] = [
  {
    key: 'documents_missing',
    question: 'Welke documenten heb je nog van mij nodig, en tegen wanneer?',
    why: 'Een ontbrekend attest is de meest voorkomende reden dat een aktedatum opschuift.',
  },
  {
    key: 'full_settlement',
    question: 'Kan je me de volledige afrekening bezorgen, en wanneer moet welk bedrag er staan?',
    why: 'Zo weet je precies hoeveel eigen geld je wanneer nodig hebt.',
  },
  {
    key: 'charges',
    question: 'Rusten er lasten, erfdienstbaarheden of hypothecaire inschrijvingen op dit pand?',
    why: 'Zulke lasten gaan mee over en kunnen je gebruik van het pand beperken.',
  },
  {
    key: 'urban_planning',
    question: 'Wat zeggen de stedenbouwkundige inlichtingen over dit pand?',
    why: 'Een niet-vergunde uitbouw wordt na de aankoop jouw probleem.',
  },
  {
    key: 'suspensive',
    question: 'Is mijn opschortende voorwaarde voldoende ruim geformuleerd?',
    why: 'Dit is je enige uitweg als je financiering niet rondkomt.',
  },
  {
    key: 'delay',
    question: 'Wat gebeurt er als de akte niet op de geplande datum kan doorgaan?',
    why: 'Zodat je weet welke kosten of boetes daaraan vastzitten voordat het gebeurt.',
  },
  {
    key: 'soil',
    question: 'Wat staat er in het bodemattest, en wat betekent dat voor mij?',
    why: 'Bij een verontreinigde grond kunnen er saneringsverplichtingen zijn.',
  },
  {
    key: 'electrical',
    question: 'Is de elektrische keuring positief, en zo niet: wat moet ik doen en binnen welke termijn?',
    why: 'Bij een negatief verslag geldt doorgaans een hersteltermijn na de aankoop.',
  },
]

/**
 * Het voorbehoud onder de hele module.
 *
 * Staat in het domein zodat er geen notarisscherm kan bestaan dat het weglaat.
 */
export const NOTARY_DISCLAIMER =
  'Halal Home helpt je voorbereiden en verstrekt geen notariële of juridische goedkeuring. ' +
  'Wat hier staat is algemene informatie over het gebruikelijke verloop in België; jouw dossier ' +
  'kan afwijken. Je notaris beoordeelt je akte en is daarvoor aansprakelijk — wij niet.'

export const GUIDANCE_KIND_LABELS: Record<GuidanceKind, string> = {
  information: 'Ter informatie',
  preparation: 'Voorbereiden',
  attention: 'Let op',
  question: 'Vraag het na',
}
