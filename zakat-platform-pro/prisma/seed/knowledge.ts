import type { KnowledgeCategory, PrismaClient } from '@/generated/prisma/client'

/**
 * Knowledge base seed (§36).
 *
 * These articles explain *what the application does and why*, in neutral terms,
 * and are marked `IN_REVIEW` — nothing here is presented as a reviewed religious
 * ruling until a qualified reviewer has signed off and `reviewedBy` is filled in.
 */

interface Article {
  slug: string
  title: string
  category: KnowledgeCategory
  summary: string
  content: string
}

const ARTICLES: Article[] = [
  {
    slug: 'wat-is-zakat',
    title: 'Wat is Zakat?',
    category: 'ZAKAT_BASICS',
    summary:
      'Zakat is de jaarlijkse verplichte bijdrage over vermogen dat een volledig maanjaar in bezit is en boven de nisab uitkomt.',
    content: `Zakat is een van de vijf zuilen van de islam. Het is geen gift naar eigen inzicht, maar een recht van bepaalde groepen op een deel van je vermogen.

Drie voorwaarden bepalen of je Zakat verschuldigd bent:

1. **Soort vermogen.** Niet alles telt mee. Geld, goud, zilver, handelswaar en verhandelbare beleggingen tellen doorgaans wel; je eigen woning, auto en gebruiksgoederen niet.
2. **Nisab.** Je netto Zakat-plichtig vermogen moet boven een drempel uitkomen. Zie het artikel over nisab.
3. **Haul.** Het vermogen moet een volledig maanjaar in je bezit zijn geweest.

Komt je vermogen boven de nisab uit, dan is het gangbare tarief 2,5% over het netto bedrag.

Barakah rekent volgens de regelset die jij kiest en toont bij elke post waarom die wel of niet meetelt. De uitkomst is een berekening, geen religieus oordeel.`,
  },
  {
    slug: 'wat-is-nisab',
    title: 'Wat betekent nisab?',
    category: 'NISAB',
    summary:
      'De nisab is de minimumdrempel. Kom je er niet boven, dan ben je geen Zakat verschuldigd.',
    content: `De nisab is de ondergrens waarboven Zakat verschuldigd wordt. Klassiek wordt die uitgedrukt in edelmetaal:

- **Goudstandaard:** de waarde van 85 gram goud.
- **Zilverstandaard:** de waarde van 595 gram zilver.

Omdat de goud- en zilverprijs uiteenlopen, verschillen de twee drempels in de praktijk sterk. De zilverstandaard geeft een lagere drempel, waardoor meer mensen Zakat verschuldigd zijn en meer ontvangers ervan profiteren. De goudstandaard geeft een hogere drempel.

Beide posities worden verdedigd. Barakah kiest niet voor je: je stelt zelf in welke basis je gebruikt, en de gebruikte prijs wordt bij je berekening opgeslagen zodat die achteraf niet verandert.`,
  },
  {
    slug: 'goud-of-zilver-als-nisab',
    title: 'Waarom gebruiken sommige mensen goud en anderen zilver?',
    category: 'NISAB',
    summary:
      'Het verschil komt voort uit hoe de klassieke maten worden vertaald naar moderne prijzen — niet uit een rekenfout.',
    content: `In de tijd waarin de nisab werd vastgesteld lagen de waarden van goud en zilver dicht bij elkaar. Vandaag is dat niet meer zo: 595 gram zilver is aanzienlijk minder waard dan 85 gram goud.

Wie de **zilverstandaard** aanhoudt, redeneert dat de lagere drempel het doel van Zakat het best dient: meer mensen dragen bij, meer behoeftigen ontvangen.

Wie de **goudstandaard** aanhoudt, redeneert dat die beter aansluit bij wat destijds als "welgesteld" gold.

Barakah toont bij elke berekening welke basis is gebruikt, met welk gewicht en tegen welke prijs. Zo is de uitkomst altijd navertelbaar, ongeacht welke keuze je maakt.`,
  },
  {
    slug: 'tellen-schulden-mee',
    title: 'Mag ik mijn schulden aftrekken?',
    category: 'DEBT',
    summary:
      'Kortlopende verplichtingen zijn doorgaans aftrekbaar; een volledige hypotheek in één keer aftrekken is dat niet.',
    content: `Het uitgangspunt is dat verplichtingen die je op korte termijn moet voldoen, van je Zakat-plichtig vermogen af mogen. Denk aan een openstaande factuur, een kredietkaartsaldo of een belastingaanslag die al vaststaat.

Wat doorgaans **niet** in één keer aftrekbaar is, is de volledige restschuld van een langlopende lening zoals een hypotheek. Een veelgebruikte benadering is dan om alleen de aflossingen van de komende twaalf maanden mee te nemen.

Barakah trekt niet automatisch elke schuld af. Per categorie ligt in de regelset vast of die standaard aftrekbaar is, en je kunt het per post overrulen. Wat er is afgetrokken en waarom, staat in je berekening.`,
  },
  {
    slug: 'beleggingen-en-zakat',
    title: 'Hoe zit het met beleggingen?',
    category: 'INVESTMENTS',
    summary:
      'De behandeling hangt af van je intentie: handel je actief, of houd je aan voor de lange termijn?',
    content: `Voor beleggingen lopen de benaderingen uiteen:

- **Handelsintentie.** Koop je aandelen om ze door te verkopen, dan wordt de volledige marktwaarde doorgaans als handelswaar behandeld en telt die volledig mee.
- **Lange termijn.** Houd je aan voor dividend of pensioen, dan hanteren sommigen alleen het Zakat-plichtige deel van de onderliggende bedrijfsactiva.

Barakah gebruikt standaard 100%, en laat je dat percentage per post aanpassen als je een andere benadering volgt. De gebruikte percentages worden bij je berekening bewaard.

Voor pensioenpotten waar je niet vrij over kunt beschikken, verschillen de meningen sterk. Leg die vraag voor aan een geleerde die je situatie kent.`,
  },
  {
    slug: 'crypto-en-zakat',
    title: 'Telt crypto mee?',
    category: 'CRYPTO',
    summary:
      'De gangbare benadering behandelt verhandelbare crypto als bezit dat volledig meetelt tegen de waarde op je peildatum.',
    content: `Crypto is nieuw, de discussie erover niet: de vraag is of het functioneert als geld, als handelswaar, of als geen van beide.

De meest gebruikte benadering behandelt vrij verhandelbare crypto als vermogen dat volledig meetelt, gewaardeerd tegen de koers op je peildatum.

Onduidelijker zijn gestakete tegoeden, illiquide tokens en NFT's. Barakah dwingt daar geen positie in af: je voert de waarde in die jij verantwoord acht, en de berekening laat zien wat je hebt meegeteld.`,
  },
  {
    slug: 'zakat-en-sadaqah',
    title: 'Wat is het verschil tussen Zakat en Sadaqah?',
    category: 'SADAQAH',
    summary:
      'Zakat is verplicht en gebonden aan regels en ontvangers. Sadaqah is vrijwillig en vrij te besteden.',
    content: `**Zakat** is verplicht, kent een vast tarief, een drempel en een vastgelegde kring van rechthebbenden. Je kunt Zakat niet aan zomaar elk doel geven.

**Sadaqah** is vrijwillig. Er is geen minimum, geen maximum en geen voorgeschreven ontvanger.

**Sadaqah Jariyah** is doorlopende liefdadigheid: een waterput, een school, een boom — iets waarvan het voordeel blijft doorlopen.

Barakah houdt deze categorieën uit elkaar. Een Sadaqah-betaling telt nooit mee als aflossing van je Zakat-schuld, en omgekeerd.`,
  },
]

export async function seedKnowledge(prisma: PrismaClient) {
  for (const article of ARTICLES) {
    await prisma.knowledgeArticle.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
      },
      create: {
        ...article,
        // Published so the content is reachable, but explicitly not signed off as
        // reviewed — `reviewedBy` stays empty until a qualified reviewer fills it.
        reviewStatus: 'IN_REVIEW',
        published: true,
        methodology: 'DEFAULT',
      },
    })
  }

  return ARTICLES.length
}
