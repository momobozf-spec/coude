/**
 * Development seed.
 *
 * Idempotent: alles gaat via `upsert` op een stabiele sleutel, dus twee keer
 * draaien geeft geen duplicaten en gooit geen unieke-constraint-fout.
 *
 * Wat erin gaat:
 *   - één ontwikkelgebruiker met een journey en alle blauwdruktaken;
 *   - de begrippenbibliotheek (redactionele inhoud, met bron);
 *   - checklists voor financiering, notaris en verhuizen;
 *   - kostenregels per gewest (gemarkeerd als níet nagekeken);
 *   - verzonnen financieringsaanbieders (gemarkeerd als demo);
 *   - een paar voorbeeldwoningen en dienstverleners.
 *
 * Wat er NIET in gaat: echte aanbieders, echte certificeringen, echte
 * geverifieerde tarieven. Zie de kop van prisma/seed-data/financing.ts voor de
 * reden.
 */
import {
  ChecklistImportance,
  DocumentCategory,
  DocumentStatus,
  JourneyStage,
  OnboardingGoal,
  PrismaClient,
  PurchaseTimeline,
  PurchaseType,
  ServiceCategory,
  TaskPriority,
  TaskStatus,
  TransactionType,
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

import {
  BE_BLUEPRINT,
  CURRENT_BLUEPRINT_VERSION,
  dependenciesOf,
} from '../src/modules/journey/domain/blueprint'
import { calculateProgress } from '../src/modules/journey/domain/progress'
import {
  CRITERIA_SCHEMA_VERSION,
  searchCriteriaSchema,
} from '../src/modules/search/schemas/searchCriteria'
import { BE_CHECKLISTS } from './seed-data/checklists'
import { BE_COST_RULES } from './seed-data/costRules'
import { DEMO_FINANCING_PROVIDERS } from './seed-data/financing'
import { BE_TERMS } from './seed-data/terms'

const prisma = new PrismaClient()

const SEED_EMAIL = (process.env.SEED_USER_EMAIL ?? 'dev@halalhome.local').toLowerCase()
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'halalhome123'
const SEED_NAME = process.env.SEED_USER_NAME ?? 'Mohamed'

/**
 * Een tweede account, uitsluitend om de scheiding tussen gebruikers met de hand
 * te kunnen natrekken.
 *
 * De isolatie is in de integratietests tegen een echte database bewezen, maar
 * dat is bewijs dat je moet lezen. Met twee accounts kan je het zélf proberen:
 * log in als deze gebruiker, plak de document-URL of de gesigneerde download-URL
 * van de andere, en je hoort een 404 te krijgen — niet zijn loonfiche.
 *
 * Bewust een eigen traject en een eigen document, zodat het verschil zichtbaar
 * is en je niet per ongeluk naar dezelfde rij zit te kijken.
 */
const SECOND_EMAIL = (process.env.SEED_SECOND_USER_EMAIL ?? 'test@halalhome.local').toLowerCase()
const SECOND_PASSWORD = process.env.SEED_SECOND_USER_PASSWORD ?? 'halalhome123'
const SECOND_NAME = process.env.SEED_SECOND_USER_NAME ?? 'Fatima'

/** Vaste datums, zodat een seed-run reproduceerbaar is. */
const NOW = new Date()
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 86_400_000)

async function seedUser() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: {
      email: SEED_EMAIL,
      name: SEED_NAME,
      passwordHash,
      onboardingCompleted: true,
      onboardingStep: 5,
      // Bedragen in eurocent; zie src/lib/money.ts.
      onboarding: {
        goal: OnboardingGoal.READY_TO_BUY,
        country: 'BE',
        region: 'FLANDERS',
        city: 'Gent',
        postalCode: '9000',
        radiusKm: 15,
        maxBudgetCents: 450_000_00,
        ownFundsCents: 90_000_00,
        needsFinancing: true,
        purchaseType: PurchaseType.EXISTING,
        firstHome: true,
        timeline: PurchaseTimeline.WITHIN_6_MONTHS,
        priorities: ['halal_financing', 'mosque_nearby', 'schools_nearby'],
      },
    },
    update: { passwordHash, name: SEED_NAME },
  })

  await prisma.neighborhoodPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mosqueWeight: 4,
      schoolWeight: 4,
      halalShopWeight: 3,
      supermarketWeight: 2,
      publicTransportWeight: 3,
      healthcareWeight: 2,
      parkWeight: 1,
    },
    update: {},
  })

  console.log(`  gebruiker: ${SEED_EMAIL}`)
  return user
}

/**
 * Het tweede account. Zie de toelichting bij `SECOND_EMAIL`.
 *
 * Deliberaat andere gegevens dan het eerste — andere stad, ander budget, geen
 * eerste woning. Twee accounts die op elkaar lijken, maken het lastig te zien
 * of je nu naar je eigen data kijkt of naar die van de ander.
 */
async function seedSecondUser() {
  const passwordHash = await bcrypt.hash(SECOND_PASSWORD, 12)

  const user = await prisma.user.upsert({
    where: { email: SECOND_EMAIL },
    create: {
      email: SECOND_EMAIL,
      name: SECOND_NAME,
      passwordHash,
      onboardingCompleted: true,
      onboardingStep: 5,
      onboarding: {
        goal: OnboardingGoal.ORIENTING,
        country: 'BE',
        region: 'BRUSSELS',
        city: 'Brussel',
        postalCode: '1000',
        radiusKm: 10,
        maxBudgetCents: 320_000_00,
        ownFundsCents: 45_000_00,
        needsFinancing: true,
        purchaseType: PurchaseType.EXISTING,
        firstHome: false,
        timeline: PurchaseTimeline.WITHIN_12_MONTHS,
        priorities: ['mosque_nearby', 'public_transport'],
      },
    },
    update: { passwordHash, name: SECOND_NAME },
  })

  const journey = await seedJourney(user.id, 'Traject van Fatima')

  // Een eigen document, zodat je iets hebt om vanaf het andere account te
  // proberen te openen.
  const existing = await prisma.document.findFirst({
    where: { userId: user.id, checklistItemKey: 'doc.identity_card' },
    select: { id: true },
  })

  if (!existing) {
    await prisma.document.create({
      data: {
        userId: user.id,
        journeyId: journey.id,
        category: DocumentCategory.IDENTITY,
        originalFilename: 'identiteitskaart-fatima.pdf',
        displayName: 'Identiteitskaart van Fatima (voorbeeld)',
        description: 'Voorbeelddocument uit de seed. Er hoort geen echt bestand bij.',
        storageKey: `documents/${user.id}/identity/seed-placeholder`,
        mimeType: 'application/pdf',
        sizeBytes: 0,
        status: DocumentStatus.PENDING,
        isDemo: true,
        checklistItemKey: 'doc.identity_card',
      },
    })
  }

  console.log(`  tweede gebruiker: ${SECOND_EMAIL}`)
  return user
}

async function seedTerms() {
  for (const term of BE_TERMS) {
    await prisma.propertyTerm.upsert({
      where: { slug: term.slug },
      create: {
        slug: term.slug,
        term: term.term,
        category: term.category,
        simpleExplanation: term.simpleExplanation,
        detailedExplanation: term.detailedExplanation ?? null,
        aliases: term.aliases ?? [],
        sourceUrl: term.sourceUrl ?? null,
        lastVerifiedAt: term.sourceUrl ? NOW : null,
      },
      update: {
        term: term.term,
        simpleExplanation: term.simpleExplanation,
        detailedExplanation: term.detailedExplanation ?? null,
        aliases: term.aliases ?? [],
      },
    })
  }
  console.log(`  begrippen: ${BE_TERMS.length}`)
}

async function seedChecklists() {
  let itemCount = 0

  for (const template of BE_CHECKLISTS) {
    const saved = await prisma.checklistTemplate.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        name: template.name,
        description: template.description ?? null,
        scope: template.scope,
        country: template.country,
        region: template.region ?? null,
        stage: template.stage ?? null,
        purchaseType: template.purchaseType ?? null,
        sortOrder: template.sortOrder,
        sourceUrl: template.sourceUrl ?? null,
        disclaimer: template.disclaimer ?? null,
        // Bewust null wanneer er geen bron is: de UI toont dan 'nog niet
        // nagekeken' in plaats van een geruststelling die niemand gaf.
        lastVerifiedAt: template.sourceUrl ? NOW : null,
      },
      update: { name: template.name, sortOrder: template.sortOrder },
    })

    for (const [index, item] of template.items.entries()) {
      await prisma.checklistItem.upsert({
        where: { templateId_key: { templateId: saved.id, key: item.key } },
        create: {
          templateId: saved.id,
          key: item.key,
          title: item.title,
          description: item.description ?? null,
          section: item.section ?? null,
          importance: item.importance ?? ChecklistImportance.REQUIRED,
          documentCategory: item.documentCategory ?? null,
          termSlug: item.termSlug ?? null,
          helpText: item.helpText ?? null,
          sortOrder: index * 10,
        },
        update: { title: item.title, sortOrder: index * 10 },
      })
      itemCount++
    }
  }

  console.log(`  checklists: ${BE_CHECKLISTS.length} templates, ${itemCount} items`)
}

async function seedCostRules() {
  for (const rule of BE_COST_RULES) {
    // Geen unieke sleutel op deze combinatie in het schema — een gewest kan
    // meerdere elkaar opvolgende regels hebben. We dedupliceren daarom op
    // (land, gewest, type, ingangsdatum).
    const existing = await prisma.costRule.findFirst({
      where: {
        country: rule.country,
        region: rule.region,
        ruleType: rule.ruleType,
        validFrom: rule.validFrom,
      },
      select: { id: true },
    })

    const data = {
      country: rule.country,
      region: rule.region,
      ruleType: rule.ruleType,
      validFrom: rule.validFrom,
      validUntil: rule.validUntil,
      configuration: rule.configuration,
      sourceUrl: rule.sourceUrl,
      // Bewust null: deze waarden zijn NIET nagekeken, en de UI moet dat tonen.
      lastVerifiedAt: null,
      notes: rule.notes,
    }

    if (existing) {
      await prisma.costRule.update({ where: { id: existing.id }, data })
    } else {
      await prisma.costRule.create({ data })
    }
  }
  console.log(`  kostenregels: ${BE_COST_RULES.length} (gemarkeerd als niet nagekeken)`)
}

async function seedFinancing() {
  let productCount = 0

  for (const provider of DEMO_FINANCING_PROVIDERS) {
    const saved = await prisma.financingProvider.upsert({
      where: { slug: provider.slug },
      create: {
        slug: provider.slug,
        name: provider.name,
        country: provider.country,
        website: provider.website,
        description: provider.description,
        verified: provider.verified,
        isDemo: provider.isDemo,
      },
      update: { name: provider.name, description: provider.description },
    })

    for (const product of provider.products) {
      await prisma.financingProduct.upsert({
        where: { slug: product.slug },
        create: {
          slug: product.slug,
          providerId: saved.id,
          name: product.name,
          financingType: product.financingType,
          country: provider.country,
          description: product.description,
          structureExplanation: product.structureExplanation,
          minAmount: product.minAmount ?? null,
          maxAmount: product.maxAmount ?? null,
          minOwnContributionPercentage: product.minOwnContributionPercentage ?? null,
          termMinMonths: product.termMinMonths ?? null,
          termMaxMonths: product.termMaxMonths ?? null,
          profitRateBasisPoints: product.profitRateBasisPoints ?? null,
          rateBasisDescription: product.rateBasisDescription ?? null,
          feesDescription: product.feesDescription ?? null,
          setupFeeAmount: product.setupFeeAmount ?? null,
          shariahAssessmentStatus: product.shariahAssessmentStatus,
          certificationBody: product.certificationBody ?? null,
          certificationUrl: product.certificationUrl ?? null,
          sourceUrl: product.sourceUrl ?? null,
          lastVerifiedAt: product.sourceUrl ? NOW : null,
          disclaimer: product.disclaimer ?? null,
          isDemo: provider.isDemo,
        },
        update: { name: product.name, description: product.description },
      })
      productCount++
    }
  }

  console.log(
    `  financiering: ${DEMO_FINANCING_PROVIDERS.length} demo-aanbieders, ${productCount} producten`,
  )
}

/**
 * De naam en de startfase zijn parameters omdat er twee accounts geseed worden.
 * `userId_name` is de unieke sleutel waar de upsert op steunt; met een vaste
 * naam zou het tweede traject de idempotentie niet verliezen, maar zou je in de
 * UI twee keer "Mijn eerste woning" zien en niet meer weten wie je bent.
 */
async function seedJourney(userId: string, name = 'Mijn eerste woning') {
  const journey = await prisma.homeBuyingJourney.upsert({
    where: { userId_name: { userId, name } },
    create: {
      userId,
      name,
      currentStage: JourneyStage.FINANCING,
      targetBudgetCents: 450_000_00,
      ownContributionCents: 90_000_00,
      needsFinancing: true,
      targetLocation: 'Gent',
      targetPostalCode: '9000',
      searchRadiusKm: 15,
      country: 'BE',
      region: 'FLANDERS',
      purchaseType: PurchaseType.EXISTING,
      timeline: PurchaseTimeline.WITHIN_6_MONTHS,
      firstHome: true,
      targetDate: daysFromNow(180),
      blueprintVersion: CURRENT_BLUEPRINT_VERSION,
      initializedAt: NOW,
    },
    update: {},
  })

  // Blauwdruktaken. Zelfde logica als journeyService.applyBlueprint, hier
  // uitgeschreven omdat de seed geen server-only modules mag importeren.
  const idByKey = new Map<string, string>()

  for (const [index, task] of BE_BLUEPRINT.tasks.entries()) {
    const saved = await prisma.journeyTask.upsert({
      where: { journeyId_templateKey: { journeyId: journey.id, templateKey: task.key } },
      create: {
        journeyId: journey.id,
        userId,
        stage: task.stage,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority ?? TaskPriority.NORMAL,
        optional: task.optional ?? false,
        sortOrder: index * 10,
        templateKey: task.key,
        system: true,
      },
      update: { title: task.title, sortOrder: index * 10 },
      select: { id: true },
    })
    idByKey.set(task.key, saved.id)
  }

  for (const task of BE_BLUEPRINT.tasks) {
    const taskId = idByKey.get(task.key)
    //  levert zowel de blokkerende als de adviserende
    // afhankelijkheden. Alleen  gebruiken zou een geseed traject
    // zonder blokkering opleveren — en dan beschermt de ontwikkelomgeving niet
    // tegen precies de fout die het platform moet voorkomen.
    const dependencies = dependenciesOf(task)
    if (!taskId || dependencies.length === 0) continue

    for (const { dependsOnKey, type } of dependencies) {
      const dependsOnId = idByKey.get(dependsOnKey)
      if (!dependsOnId) continue
      await prisma.taskDependency.upsert({
        where: { taskId_dependsOnId: { taskId, dependsOnId } },
        create: { taskId, dependsOnId, type },
        update: { type },
      })
    }
  }

  // Een realistische startsituatie: oriëntatie en budget afgewerkt, financiering
  // half. Zo toont het dashboard meteen waar het voor bedoeld is.
  const completedKeys = [
    'ORIENTATION_DEFINE_AREA',
    'ORIENTATION_SET_NEIGHBORHOOD_PRIORITIES',
    'ORIENTATION_CHOOSE_PROPERTY_TYPE',
    'BUDGET_SET_OWN_FUNDS',
    'BUDGET_ESTIMATE_COSTS',
    'BUDGET_SET_MAX_PRICE',
    'FINANCING_DETERMINE_NEED',
    'FINANCING_UPLOAD_IDENTITY',
  ]

  await prisma.journeyTask.updateMany({
    where: { journeyId: journey.id, templateKey: { in: completedKeys } },
    data: { status: TaskStatus.COMPLETED, completedAt: NOW },
  })

  const tasks = await prisma.journeyTask.findMany({
    where: { journeyId: journey.id },
    select: { status: true, optional: true },
  })

  await prisma.homeBuyingJourney.update({
    where: { id: journey.id },
    data: { progressPercentage: calculateProgress(JourneyStage.FINANCING, tasks) },
  })

  // Een paar afspraken, zodat "komende deadlines" niet leeg is.
  const events = [
    {
      key: 'seed-viewing',
      type: 'VIEWING' as const,
      title: 'Bezichtiging woning Gent',
      startsAt: daysFromNow(5),
    },
    {
      key: 'seed-financing-deadline',
      type: 'DOCUMENT_DEADLINE' as const,
      title: 'Documenten financiering indienen',
      dueAt: daysFromNow(11),
    },
  ]

  for (const event of events) {
    const existing = await prisma.journeyEvent.findFirst({
      where: { journeyId: journey.id, title: event.title },
      select: { id: true },
    })
    if (existing) continue

    await prisma.journeyEvent.create({
      data: {
        journeyId: journey.id,
        userId,
        type: event.type,
        title: event.title,
        startsAt: event.startsAt ?? null,
        dueAt: event.dueAt ?? null,
        remindDaysBefore: 2,
      },
    })
  }

  console.log(`  traject: ${BE_BLUEPRINT.tasks.length} taken, ${events.length} afspraken`)
  return journey
}

async function seedChecklistProgress(userId: string, journeyId: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { key: 'be.documents.financing' },
    include: { items: true },
  })
  if (!template) return

  // Twee items afgevinkt, de rest open — genoeg om de voortgangsbalk te tonen.
  const completedKeys = new Set(['doc.identity_card', 'doc.payslips'])

  for (const item of template.items) {
    await prisma.userChecklistItem.upsert({
      where: { journeyId_itemId: { journeyId, itemId: item.id } },
      create: {
        userId,
        journeyId,
        itemId: item.id,
        completed: completedKeys.has(item.key),
        completedAt: completedKeys.has(item.key) ? NOW : null,
      },
      update: {},
    })
  }
}

async function seedProperties() {
  const properties = [
    {
      externalId: 'fixture-001',
      title: 'Ruime woning met tuin nabij centrum Gent',
      description:
        'Instapklare woning met 4 slaapkamers, zuidgerichte tuin en zonnepanelen. EPC A. Op wandelafstand van scholen en winkels.',
      address: 'Voorbeeldstraat 12',
      postalCode: '9000',
      city: 'Gent',
      latitude: 51.0543,
      longitude: 3.7174,
      propertyType: 'house',
      price: 415_000,
      bedrooms: 4,
      bathrooms: 1,
      livingAreaM2: 178,
      landAreaM2: 320,
      epcLabel: 'A',
      features: ['garden', 'solar_panels', 'renovated'],
    },
    {
      externalId: 'fixture-002',
      title: 'Nieuwbouwappartement met terras, Ledeberg',
      description:
        'Energiezuinig appartement met 3 slaapkamers, terras en ondergrondse parking. Vlot bereikbaar met het openbaar vervoer.',
      address: 'Voorbeeldlaan 44',
      postalCode: '9050',
      city: 'Gentbrugge',
      latitude: 51.0362,
      longitude: 3.7515,
      propertyType: 'apartment',
      price: 389_000,
      bedrooms: 3,
      bathrooms: 2,
      livingAreaM2: 124,
      epcLabel: 'A+',
      features: ['terrace', 'parking', 'elevator', 'new_build', 'heat_pump'],
    },
    {
      externalId: 'fixture-003',
      title: 'Te renoveren rijwoning, Sint-Amandsberg',
      description:
        'Rijwoning met veel potentieel op een goede locatie. Renovatie noodzakelijk. 3 slaapkamers en een kleine stadstuin.',
      address: 'Voorbeeldplein 7',
      postalCode: '9040',
      city: 'Sint-Amandsberg',
      latitude: 51.0625,
      longitude: 3.7469,
      propertyType: 'house',
      price: 279_000,
      bedrooms: 3,
      bathrooms: 1,
      livingAreaM2: 132,
      landAreaM2: 145,
      epcLabel: 'E',
      features: ['garden'],
    },
  ]

  for (const property of properties) {
    const url = `https://example.com/woning/${property.externalId}`
    await prisma.property.upsert({
      where: { source_externalId: { source: 'fixture', externalId: property.externalId } },
      create: {
        ...property,
        source: 'fixture',
        url,
        urlNormalized: url,
        // In productie is dit een sha256 van adres + prijs + oppervlakte; voor
        // de seed volstaat een stabiele waarde.
        fingerprint: `fixture-${property.externalId}`,
        transactionType: TransactionType.BUY,
        country: 'BE',
        region: 'FLANDERS',
        publishedAt: daysFromNow(-14),
      },
      update: { price: property.price, title: property.title },
    })
  }

  console.log(`  woningen: ${properties.length} voorbeelden`)
}

async function seedServiceProviders() {
  const providers = [
    {
      name: 'Voorbeeld Notariskantoor (demo)',
      category: ServiceCategory.NOTARY,
      city: 'Gent',
      description: 'Verzonnen dienstverlener voor de ontwikkelomgeving.',
    },
    {
      name: 'Voorbeeld Verhuisdienst (demo)',
      category: ServiceCategory.MOVING,
      city: 'Gent',
      description: 'Verzonnen dienstverlener voor de ontwikkelomgeving.',
    },
    {
      name: 'Voorbeeld Woningkeuring (demo)',
      category: ServiceCategory.INSPECTION,
      city: 'Gent',
      description: 'Verzonnen dienstverlener voor de ontwikkelomgeving.',
    },
  ]

  for (const provider of providers) {
    const existing = await prisma.serviceProvider.findFirst({
      where: { name: provider.name },
      select: { id: true },
    })
    if (existing) continue

    await prisma.serviceProvider.create({
      data: { ...provider, country: 'BE', partner: false, verified: false },
    })
  }

  console.log(`  dienstverleners: ${providers.length} demo`)
}

async function seedDocumentPlaceholders(userId: string, journeyId: string) {
  // Eén metadata-rij zonder bestand: genoeg om de documentenlijst en de
  // aanbevelingsregels te laten zien. Er wordt bewust niets naar de opslag
  // geschreven — een seed hoort geen bestanden te maken.
  const existing = await prisma.document.findFirst({
    where: { userId, checklistItemKey: 'doc.identity_card' },
    select: { id: true },
  })
  if (existing) return

  await prisma.document.create({
    data: {
      userId,
      journeyId,
      category: DocumentCategory.IDENTITY,
      originalFilename: 'identiteitskaart-voorbeeld.pdf',
      displayName: 'Identiteitskaart (voorbeeld)',
      description:
        'Voorbeelddocument uit de seed. Er hoort geen echt bestand bij.',
      storageKey: `documents/${userId}/identity/seed-placeholder`,
      mimeType: 'application/pdf',
      sizeBytes: 0,
      // PENDING en niet AVAILABLE: er staat geen bestand in de opslag, en een
      // rij mag nooit doen alsof er wel een is. De kluis toont dit dus als
      // "bezig met uploaden" en biedt geen downloadknop aan.
      status: DocumentStatus.PENDING,
      isDemo: true,
      checklistItemKey: 'doc.identity_card',
    },
  })
}

/**
 * Eén opgeslagen zoekopdracht plus een bewaarde woning.
 *
 * Zo tonen /search en /saved meteen iets, en is de flow van zoeken tot bewaren
 * te bekijken zonder eerst zelf een zoekopdracht te typen.
 */
async function seedSearch(userId: string, journeyId: string) {
  const criteria = searchCriteriaSchema.parse({
    transactionType: 'buy',
    locations: ['Gent'],
    hardRequirements: {
      propertyTypes: ['house'],
      maxPrice: 450_000,
      minBedrooms: 3,
    },
    preferences: {
      epcLabels: ['A++', 'A+', 'A', 'B'],
      features: ['garden'],
      nearby: [{ category: 'mosque', maxDistanceMeters: 2000 }],
    },
  })

  const search = await prisma.propertySearch.upsert({
    where: { userId_name: { userId, name: 'Huis in Gent met tuin' } },
    create: {
      userId,
      journeyId,
      name: 'Huis in Gent met tuin',
      originalQuery:
        'Huis rond Gent onder €450.000, minstens 3 slaapkamers, liefst EPC A of B, met tuin en dichtbij een moskee',
      criteria,
      criteriaVersion: CRITERIA_SCHEMA_VERSION,
    },
    update: { criteria },
  })

  // Eén woning bewaard, zodat de vergelijking en de statusselectie iets tonen.
  const property = await prisma.property.findFirst({
    where: { source: 'fixture', externalId: 'fixture-001' },
    select: { id: true, price: true },
  })

  if (property) {
    await prisma.savedProperty.upsert({
      where: { userId_propertyId: { userId, propertyId: property.id } },
      create: {
        userId,
        propertyId: property.id,
        journeyId,
        status: 'SHORTLISTED',
        priceAtSave: property.price,
      },
      update: {},
    })
  }

  console.log('  zoekopdracht: 1 met 1 bewaarde woning')
  return search
}

async function main() {
  console.log('Halal Home — seed')

  const user = await seedUser()
  await seedSecondUser()
  await seedTerms()
  await seedChecklists()
  await seedCostRules()
  await seedFinancing()
  await seedProperties()
  await seedServiceProviders()

  const journey = await seedJourney(user.id)
  await seedChecklistProgress(user.id, journey.id)
  await seedDocumentPlaceholders(user.id, journey.id)
  await seedSearch(user.id, journey.id)

  console.log('\nKlaar. Inloggen met:')
  console.log(`  ${SEED_EMAIL} / ${SEED_PASSWORD}`)
  console.log(`  ${SECOND_EMAIL} / ${SECOND_PASSWORD}   (tweede account, om de scheiding te testen)`)
  console.log(
    '\nLet op: financieringsaanbieders en kostenregels zijn DEMODATA en niet geverifieerd.',
  )
}

main()
  .catch((error) => {
    console.error('Seed mislukt:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
