/**
 * Begrippenbibliotheek — Belgische vastgoed-, notaris- en fiscale termen.
 *
 * Redactionele inhoud. Dit is precies het soort tekst dat GEEN AI mag
 * genereren: een verzonnen definitie van "opschortende voorwaarde" ziet er
 * overtuigend uit en kan iemand een aankoop kosten.
 *
 * Elke term draagt een `sourceUrl` naar een officiële of professionele bron.
 * Waar de bron ontbreekt, hoort de UI dat te tonen.
 */
import { TermCategory } from '@prisma/client'

export interface SeedTerm {
  slug: string
  term: string
  category: TermCategory
  simpleExplanation: string
  detailedExplanation?: string
  aliases?: string[]
  sourceUrl?: string
}

export const BE_TERMS: SeedTerm[] = [
  {
    slug: 'compromis-de-vente',
    term: 'Compromis de vente',
    category: TermCategory.LEGAL,
    aliases: ['compromis', 'verkoopovereenkomst', 'onderhandse verkoopovereenkomst'],
    simpleExplanation:
      'De verkoopovereenkomst die je tekent vóór de notariële akte. Vanaf dat moment is de verkoop in principe rond.',
    detailedExplanation:
      'In België geldt: "koop breekt geen huur" en een getekend compromis bindt beide partijen. ' +
      'De notariële akte die enkele maanden later volgt, maakt de eigendomsoverdracht officieel tegenover derden. ' +
      'Laat het compromis altijd nalezen vóór je tekent: de opschortende voorwaarden die erin staan, bepalen wat er gebeurt ' +
      'als je financiering niet rondkomt.',
    sourceUrl: 'https://www.notaris.be/',
  },
  {
    slug: 'opschortende-voorwaarde',
    term: 'Opschortende voorwaarde',
    category: TermCategory.LEGAL,
    aliases: ['voorwaarde', 'suspensieve voorwaarde'],
    simpleExplanation:
      'Een clausule die zegt: de koop gaat alleen door als er iets gebeurt — meestal dat je je financiering rond krijgt.',
    detailedExplanation:
      'Zonder deze clausule ben je gebonden aan de koop, ook als geen enkele aanbieder je wil financieren. ' +
      'Dan riskeer je een schadevergoeding, vaak 10 % van de aankoopprijs. ' +
      'Let op de termijn die erin staat: die is meestal kort (vier tot zes weken). Begin dus vóór je bod met je financieringsaanvraag.',
    sourceUrl: 'https://www.notaris.be/',
  },
  {
    slug: 'registratierechten',
    term: 'Registratierechten',
    category: TermCategory.TAX,
    aliases: ['verkooprecht', 'registratiebelasting'],
    simpleExplanation:
      'De belasting die je betaalt bij de aankoop van een woning. Het tarief hangt af van het gewest en of het je enige eigen woning is.',
    detailedExplanation:
      'De tarieven verschillen tussen Vlaanderen, Brussel en Wallonië en zijn de afgelopen jaren meermaals gewijzigd. ' +
      'Halal Home rekent met de tarieven die in de kostenregels staan, met vermelding van de bron en de datum waarop ze zijn nagekeken. ' +
      'Controleer altijd bij de belastingdienst van je gewest of bij je notaris.',
    sourceUrl: 'https://www.vlaanderen.be/verkooprecht',
  },
  {
    slug: 'hypothecaire-inschrijving',
    term: 'Hypothecaire inschrijving',
    category: TermCategory.FINANCING,
    aliases: ['hypotheek', 'inschrijving'],
    simpleExplanation:
      'De officiële registratie waarmee de financier een zekerheid neemt op je woning. Daar zijn eenmalige kosten aan verbonden.',
    detailedExplanation:
      'De inschrijving loopt via de notaris en wordt berekend over het bedrag dat je financiert, niet over de aankoopprijs. ' +
      'Zij bestaat uit registratierecht, ereloon en aktekosten.',
    sourceUrl: 'https://www.notaris.be/',
  },
  {
    slug: 'epc',
    term: 'EPC',
    category: TermCategory.ENERGY,
    aliases: ['energieprestatiecertificaat', 'energielabel'],
    simpleExplanation:
      'Het energieprestatiecertificaat: een label van A tot F dat aangeeft hoe energiezuinig een woning is.',
    detailedExplanation:
      'De verkoper is verplicht het EPC te tonen bij verkoop, en het label moet in de advertentie staan. ' +
      'Naast het label staat er een kengetal in kWh/m² per jaar; dat is preciezer dan de letter, omdat de labelgrenzen per gewest verschillen. ' +
      'In Vlaanderen geldt sinds 2023 een renovatieverplichting voor woningen met een slecht label.',
    sourceUrl: 'https://www.vlaanderen.be/epc',
  },
  {
    slug: 'kadastraal-inkomen',
    term: 'Kadastraal inkomen',
    category: TermCategory.TAX,
    aliases: ['KI', 'kadastraal inkomen'],
    simpleExplanation:
      'Een fictief jaarlijks huurinkomen dat de overheid aan je woning toekent. Het bepaalt hoeveel onroerende voorheffing je jaarlijks betaalt.',
    detailedExplanation:
      'Het kadastraal inkomen is niet de werkelijke huurwaarde: het is gebaseerd op een referentiejaar en wordt jaarlijks geïndexeerd. ' +
      'Na een verbouwing die de woning aanzienlijk verbetert, kan het herzien worden.',
    sourceUrl: 'https://financien.belgium.be/',
  },
  {
    slug: 'bodemattest',
    term: 'Bodemattest',
    category: TermCategory.NOTARY,
    aliases: ['bodemcertificaat', 'OVAM-attest'],
    simpleExplanation:
      'Een document van de overheid dat zegt of de grond vervuild is of ooit vervuild geweest is.',
    detailedExplanation:
      'De verkoper moet dit attest aanvragen en aan de koper bezorgen vóór de ondertekening van het compromis. ' +
      'Ontbreekt het, dan kan de verkoop nietig verklaard worden. In Vlaanderen levert OVAM het af.',
    sourceUrl: 'https://www.ovam.be/',
  },
  {
    slug: 'elektrische-keuring',
    term: 'Keuringsverslag elektriciteit',
    category: TermCategory.NOTARY,
    aliases: ['elektrische keuring', 'AREI-keuring'],
    simpleExplanation:
      'Een verslag dat zegt of de elektrische installatie voldoet aan de veiligheidsvoorschriften.',
    detailedExplanation:
      'Verplicht bij de verkoop van een woning met een installatie van vóór 1981 die nooit gekeurd is. ' +
      'Bij een negatief verslag heb je als koper achttien maanden om de installatie in orde te brengen.',
    sourceUrl: 'https://economie.fgov.be/',
  },
  {
    slug: 'stedenbouwkundige-inlichtingen',
    term: 'Stedenbouwkundige inlichtingen',
    category: TermCategory.NOTARY,
    aliases: ['stedenbouwkundig uittreksel', 'vergunningstoestand'],
    simpleExplanation:
      'Informatie van de gemeente over wat er met het pand en de omgeving mag en mag niet, en of er overtredingen bekend zijn.',
    detailedExplanation:
      'Hier zie je of er een geldige vergunning is voor wat er staat, of er een bouwovertreding geregistreerd is, ' +
      'en of er plannen zijn die je pand raken. Een niet-vergunde uitbouw wordt na de aankoop jouw probleem.',
    sourceUrl: 'https://www.vlaanderen.be/',
  },
  {
    slug: 'murabaha',
    term: 'Murabaha',
    category: TermCategory.FINANCING,
    simpleExplanation:
      'Een constructie waarbij de financier de woning koopt en aan jou doorverkoopt tegen een vooraf afgesproken prijs, die je in termijnen betaalt.',
    detailedExplanation:
      'De winstmarge staat vast bij het sluiten van het contract en verandert daarna niet. ' +
      'Halal Home beschrijft deze constructie zoals aanbieders haar documenteren en spreekt zelf geen religieus oordeel uit ' +
      'over de vraag of een specifiek product toegestaan is.',
  },
  {
    slug: 'ijara',
    term: 'Ijara',
    category: TermCategory.FINANCING,
    simpleExplanation:
      'Een constructie waarbij de financier eigenaar is en jij huurt, met een afspraak dat de eigendom uiteindelijk naar jou overgaat.',
    detailedExplanation:
      'De maandelijkse betaling bestaat uit een huurcomponent en, afhankelijk van het contract, een deel dat je aandeel opbouwt. ' +
      'De precieze vorm verschilt per aanbieder; lees altijd het productblad.',
  },
  {
    slug: 'diminishing-musharaka',
    term: 'Diminishing musharaka',
    category: TermCategory.FINANCING,
    aliases: ['afnemend partnerschap', 'musharaka mutanaqisa'],
    simpleExplanation:
      'Je koopt de woning samen met de financier. Maandelijks koop je een stuk van zijn aandeel over, tot je alles bezit.',
    detailedExplanation:
      'Je maandbedrag bestaat uit twee delen: een vergoeding voor het gebruik van het deel dat nog niet van jou is, ' +
      'en een aflossing die je eigendomsaandeel vergroot. Naarmate je aandeel groeit, daalt het gebruiksdeel.',
  },
  {
    slug: 'onroerende-voorheffing',
    term: 'Onroerende voorheffing',
    category: TermCategory.TAX,
    aliases: ['grondbelasting'],
    simpleExplanation:
      'Een jaarlijkse belasting op je woning, berekend op het geïndexeerde kadastraal inkomen.',
    detailedExplanation:
      'Je betaalt hem elk jaar zolang je eigenaar bent. Voor gezinnen met kinderen ten laste bestaan verminderingen; ' +
      'die moet je meestal niet zelf aanvragen maar wel controleren.',
    sourceUrl: 'https://www.vlaanderen.be/onroerende-voorheffing',
  },
  {
    slug: 'brandverzekering',
    term: 'Brandverzekering',
    category: TermCategory.INSURANCE,
    aliases: ['woningverzekering', 'verzekering eenvoudige risicos'],
    simpleExplanation:
      'De verzekering die je woning dekt tegen brand, water- en stormschade. Ze moet in orde zijn vanaf de dag van de akte.',
    detailedExplanation:
      'Vrijwel elke financier maakt een brandverzekering verplicht als voorwaarde. Sluit ze af vóór de aktedatum, ' +
      'niet erna: tussen de akte en de eerste dag van je polis ben je onverzekerd eigenaar.',
  },
]
