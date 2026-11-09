/**
 * Demo-data waarmee het hele systeem lokaal te bekijken is.
 *
 * ─── WAT DEZE SEED BEWUST DOET ───────────────────────────────────────────────
 *
 * Hij zet niet zomaar dertig rijen neer. Hij draait de *echte pijplijn* over
 * een verzonnen markt: dezelfde normalisatie, dezelfde classificatie, dezelfde
 * deduplicatie en dezelfde scoring die in productie draaien. Daardoor is wat je
 * in het dashboard ziet geen decor maar een werkelijke uitkomst — als de
 * classificatie een fout maakt, zie je die hier.
 *
 * Alerts staan tijdens de seed uit (`sendAlerts: false`), en worden daarna
 * gericht aangemaakt voor de leads die aan de criteria voldoen. Anders zou een
 * seed op een productiedatabase dertig Telegramberichten versturen.
 *
 * De data bevat met opzet: particulieren, makelaars, twijfelgevallen, een
 * cross-source duplicaat, een herplaatsing, en abonnementen in alle drie de
 * statussen.
 */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { generateDemoListings } from '../src/collectors/demo/demoMarketCollector'
import { mapFixtureListing } from '../src/collectors/fixture/fixtureCollector'
import type { RawListing } from '../src/domain/types'
import { bootstrapSources } from '../src/jobs/scheduler'
import { TelegramClient } from '../src/notifications/telegramClient'
import { listSources } from '../src/repositories/sourceRepository'
import { dispatchLead } from '../src/services/alertService'
import { ingestListing } from '../src/services/ingestionService'

const prisma = new PrismaClient()

/** Alles weg, in de volgorde die de foreign keys toelaten. */
async function reset(): Promise<void> {
  await prisma.alert.deleteMany()
  await prisma.listingHistory.deleteMany()
  await prisma.listing.deleteMany()
  await prisma.seller.deleteMany()
  await prisma.subscriptionTerritory.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.territory.deleteMany()
  await prisma.agency.deleteMany()
  await prisma.collectorRun.deleteMany()
  await prisma.auditLog.deleteMany()
  // Bronnen blijven staan: hun instellingen (interval, aan/uit) zijn
  // bedieningskeuzes, geen demo-data.
}

async function seedAgencies(): Promise<void> {
  // ── 1. Gent — postcodes, strenge drempels ────────────────────────────────
  const gent = await prisma.agency.create({
    data: {
      name: 'Immo Vandenberghe',
      contactEmail: 'leads@vandenberghe.example.be',
      // Verzonnen chat-id. Zonder TELEGRAM_BOT_TOKEN gaat er niets de deur uit.
      telegramChatId: '100000001',
      active: true,
    },
  })

  const gentCentrum = await prisma.territory.create({
    data: {
      agencyId: gent.id,
      name: 'Gent centrum',
      kind: 'POSTAL_CODE',
      postalCodes: ['9000', '9030', '9040', '9050'],
      active: true,
    },
  })

  const gentRand = await prisma.territory.create({
    data: {
      agencyId: gent.id,
      name: 'Gent rand (25 km)',
      kind: 'RADIUS',
      centerLat: 51.0543,
      centerLng: 3.7174,
      radiusKm: 25,
      active: true,
    },
  })

  await prisma.subscription.create({
    data: {
      agencyId: gent.id,
      name: 'Particulieren Gent — koop',
      status: 'ACTIVE',
      listingTypes: ['SALE'],
      minPrice: 150_000,
      maxPrice: 750_000,
      minLeadScore: 55,
      minPrivateConfidence: 0.85,
      requirePhone: false,
      territories: {
        create: [{ territoryId: gentCentrum.id }, { territoryId: gentRand.id }],
      },
    },
  })

  // Een gepauzeerd abonnement: hoort géén alerts te krijgen, ook al matcht het.
  await prisma.subscription.create({
    data: {
      agencyId: gent.id,
      name: 'Particulieren Gent — huur (gepauzeerd)',
      status: 'PAUSED',
      listingTypes: ['RENT'],
      minLeadScore: 40,
      minPrivateConfidence: 0.8,
      territories: { create: [{ territoryId: gentCentrum.id }] },
    },
  })

  // ── 2. Antwerpen — gemeenten, alleen leads met telefoonnummer ────────────
  const antwerpen = await prisma.agency.create({
    data: {
      name: 'Scheldezicht Vastgoed',
      contactEmail: 'info@scheldezicht.example.be',
      telegramChatId: '100000002',
      active: true,
    },
  })

  const antwerpenStad = await prisma.territory.create({
    data: {
      agencyId: antwerpen.id,
      name: 'Antwerpen stad',
      kind: 'MUNICIPALITY',
      municipalities: ['Antwerpen', 'Berchem', 'Deurne', 'Borgerhout', 'Merksem'],
      active: true,
    },
  })

  await prisma.territory.create({
    data: {
      agencyId: antwerpen.id,
      name: 'Provincie Antwerpen (inactief)',
      kind: 'PROVINCE',
      provinces: ['antwerpen'],
      active: false,
    },
  })

  await prisma.subscription.create({
    data: {
      agencyId: antwerpen.id,
      name: 'Alles particulier, met nummer',
      status: 'ACTIVE',
      listingTypes: [],
      minLeadScore: 60,
      minPrivateConfidence: 0.85,
      requirePhone: true,
      territories: { create: [{ territoryId: antwerpenStad.id }] },
    },
  })

  // ── 3. Vlaams-Brabant en Limburg — op provincie ──────────────────────────
  // Deze makelaar bestaat om de provincie-tak van de gebiedsmatching te laten
  // zien met een ontvanger die wél actief is; de vierde hieronder staat uit.
  const binnenland = await prisma.agency.create({
    data: {
      name: 'Kempen & Limburg Vastgoed',
      contactEmail: 'leads@kempenlimburg.example.be',
      telegramChatId: '100000003',
      active: true,
    },
  })

  const binnenlandProvincies = await prisma.territory.create({
    data: {
      agencyId: binnenland.id,
      name: 'Vlaams-Brabant en Limburg',
      kind: 'PROVINCE',
      provinces: ['vlaams-brabant', 'limburg'],
      active: true,
    },
  })

  await prisma.subscription.create({
    data: {
      agencyId: binnenland.id,
      name: 'Particulieren binnenland',
      status: 'ACTIVE',
      listingTypes: ['SALE'],
      minLeadScore: 55,
      minPrivateConfidence: 0.85,
      territories: { create: [{ territoryId: binnenlandProvincies.id }] },
    },
  })

  // ── 4. Wallonië — provincies, inactieve makelaar ─────────────────────────
  // Bewust inactief: een lead in dit gebied hoort nergens heen te gaan, en dat
  // moet zichtbaar zijn in de demo.
  const wallonie = await prisma.agency.create({
    data: {
      name: 'Agence Meuse & Sambre',
      contactEmail: 'contact@meuse.example.be',
      telegramChatId: '100000004',
      active: false,
    },
  })

  const provincies = await prisma.territory.create({
    data: {
      agencyId: wallonie.id,
      name: 'Luik en Namen',
      kind: 'PROVINCE',
      provinces: ['luik', 'namen'],
      active: true,
    },
  })

  await prisma.subscription.create({
    data: {
      agencyId: wallonie.id,
      name: 'Particuliers Wallonie',
      status: 'ACTIVE',
      minLeadScore: 50,
      minPrivateConfidence: 0.8,
      territories: { create: [{ territoryId: provincies.id }] },
    },
  })

  await prisma.subscription.create({
    data: {
      agencyId: wallonie.id,
      name: 'Oude formule (opgezegd)',
      status: 'CANCELLED',
      minLeadScore: 30,
      minPrivateConfidence: 0.7,
      territories: { create: [{ territoryId: provincies.id }] },
    },
  })
}

/** De advertenties uit fixtures/listings.json. */
async function loadFixtureListings(now: Date): Promise<RawListing[]> {
  const raw = await readFile(path.join(process.cwd(), 'fixtures', 'listings.json'), 'utf8')
  const parsed = JSON.parse(raw) as { listings: Parameters<typeof mapFixtureListing>[0][] }
  return parsed.listings.map((item) => mapFixtureListing(item, 'fixture-be', now))
}

/**
 * Eén handgemaakte advertentie die dezelfde woning is als fixture fx-1005, maar
 * op een andere bron en met een herschreven tekst.
 *
 * Zonder dit zou de cross-source deduplicatie in de demo nooit aanslaan, en dan
 * kan je niet zien of hij werkt.
 */
function crossSourceDuplicate(now: Date): RawListing {
  return {
    source: 'demo-be',
    sourceListingId: 'demo-crosspost-9300',
    url: 'https://demo.fsbo-lead-radar.local/zoekertjes/demo-crosspost-9300',
    title: 'Gezellige woning te koop in Aalst',
    description:
      'Woning met drie slaapkamers en een zuidgerichte tuin, 128 m². Verkoop door de eigenaar zelf, zonder makelaar en dus zonder commissie. Bereikbaar op 0473 55 66 77.',
    price: 292_000,
    currency: 'EUR',
    listingType: 'sale',
    propertyType: 'Huis',
    postalCode: '9300',
    city: 'Aalst',
    address: 'Molenstraat 33',
    bedrooms: 3,
    surfaceArea: 128,
    sellerName: 'Familie Van Damme',
    sellerPhone: '0473 55 66 77',
    sellerTypeHint: 'private',
    publishedAt: new Date(now.getTime() - 3 * 60_000),
    scrapedAt: now,
  }
}

async function main(): Promise<void> {
  console.log('Seed: opruimen …')
  await reset()

  // Dezelfde functie die de worker gebruikt: registreert elke collector en zet
  // de bronnen uit COLLECTOR_ENABLED_SOURCES aan. Zo staat het dashboard na de
  // seed meteen in dezelfde toestand als na een echte start.
  console.log('Seed: bronnen registreren …')
  await bootstrapSources()

  const sources = await listSources()
  const fixtureSource = sources.find((source) => source.key === 'fixture-be')
  const demoSource = sources.find((source) => source.key === 'demo-be')
  if (!fixtureSource || !demoSource) throw new Error('Bronnen ontbreken in het register')

  console.log('Seed: makelaars, werkgebieden en abonnementen …')
  await seedAgencies()

  const now = new Date()

  // ── De pijplijn draaien over de demo-markt ────────────────────────────────
  // Alerts uit: die maken we hierna gericht aan, zodat een seed nooit
  // ongevraagd berichten verstuurt.
  console.log('Seed: advertenties door de pijplijn halen …')

  const fixtureListings = await loadFixtureListings(now)
  for (const raw of fixtureListings) {
    await ingestListing(raw, {
      sourceId: fixtureSource.id,
      sourceName: fixtureSource.name,
      now,
      sendAlerts: false,
    })
  }

  // Drie generaties demo-advertenties met verschillende seeds, zodat er genoeg
  // variatie is en de totalen boven de dertig uitkomen.
  for (const [index, seed] of [11, 22, 33].entries()) {
    const generated = generateDemoListings({
      seed,
      count: 9,
      // Elke generatie iets ouder, zodat de versheidscomponent van de leadscore
      // zichtbaar uiteenloopt in het dashboard.
      now: new Date(now.getTime() - index * 45 * 60_000),
      sourceKey: 'demo-be',
    })

    for (const raw of generated) {
      await ingestListing(raw, {
        sourceId: demoSource.id,
        sourceName: demoSource.name,
        now,
        sendAlerts: false,
      })
    }
  }

  // Het cross-source duplicaat als laatste: de originele advertentie moet er al
  // staan voordat de deduplicatie hem kan herkennen.
  await ingestListing(crossSourceDuplicate(now), {
    sourceId: demoSource.id,
    sourceName: demoSource.name,
    now,
    sendAlerts: false,
  })

  // ── Alerts voor de leads die door de poorten kwamen ──────────────────────
  //
  // Via de échte `dispatchLead`, met een Telegram-client die bewust geen token
  // heeft. Zo doorloopt de seed dezelfde vier poorten als productie — gebied,
  // prijs, type, drempels — en komen de alerts in de database te staan met
  // status SUPPRESSED_DRY_RUN in plaats van dat er berichten uitgaan.
  //
  // De verleiding is groot om hier een vereenvoudigde matching te schrijven,
  // maar dat zou een tweede versie van de belangrijkste beslissing in het
  // systeem opleveren, die stilletjes uit de pas gaat lopen met de echte.
  console.log('Seed: alerts door de echte dispatch halen (dry-run) …')

  const dryRunTelegram = new TelegramClient({ botToken: '' })

  const qualified = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      sellerClassification: 'PRIVATE',
      sellerConfidence: { gte: 0.85 },
      leadScore: { gte: 55 },
    },
    orderBy: { leadScore: 'desc' },
    include: { source: { select: { name: true } }, seller: true },
  })

  let created = 0
  for (const listing of qualified) {
    const result = await dispatchLead(
      {
        listingId: listing.id,
        sourceName: listing.source.name,
        url: listing.url,
        postalCode: listing.postalCode,
        city: listing.city,
        province: listing.province,
        latitude: listing.latitude,
        longitude: listing.longitude,
        propertyType: listing.propertyType,
        listingType: listing.listingType === 'RENT' ? 'rent' : listing.listingType === 'SALE' ? 'sale' : null,
        price: listing.price,
        currency: listing.currency,
        bedrooms: listing.bedrooms,
        surfaceArea: listing.surfaceArea,
        sellerName: listing.seller?.displayName ?? null,
        sellerPhoneE164: listing.seller?.phoneE164 ?? null,
        sellerClassification: 'private',
        sellerConfidence: listing.sellerConfidence,
        classificationReasons: listing.classificationReasons,
        leadScore: listing.leadScore,
        firstSeenAt: listing.firstSeenAt,
        isDuplicate: false,
      },
      { now, telegram: dryRunTelegram },
    )
    created += result.matched
  }

  // ── Samenvatting ─────────────────────────────────────────────────────────
  const [listings, privateCount, professionalCount, unknownCount, duplicates, sellers] =
    await Promise.all([
      prisma.listing.count(),
      prisma.listing.count({ where: { sellerClassification: 'PRIVATE' } }),
      prisma.listing.count({ where: { sellerClassification: 'PROFESSIONAL' } }),
      prisma.listing.count({ where: { sellerClassification: 'UNKNOWN' } }),
      prisma.listing.count({ where: { status: 'DUPLICATE' } }),
      prisma.seller.count(),
    ])

  console.log(
    [
      '',
      'Seed klaar.',
      `  advertenties      ${listings}`,
      `    particulier     ${privateCount}`,
      `    makelaar        ${professionalCount}`,
      `    onbekend        ${unknownCount}`,
      `  duplicaten        ${duplicates}`,
      `  verkopers         ${sellers}`,
      `  alerts            ${created} (dry-run: vastgelegd, niet verstuurd)`,
      '',
      'Open http://localhost:3000/admin (npm run dev).',
      '',
    ].join('\n'),
  )
}

main()
  .catch((error: unknown) => {
    console.error('Seed mislukt:', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
