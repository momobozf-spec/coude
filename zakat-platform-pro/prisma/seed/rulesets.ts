import type { PrismaClient } from '@/generated/prisma/client'

/**
 * The default Zakat ruleset (§38).
 *
 * These are the widely reported classical figures — 2.5%, 85g gold, 595g silver —
 * and the default position that debts falling due in the short term are
 * deductible. They are seeded as *data with a version and a source*, not baked
 * into the engine, precisely because the details differ between madhāhib and
 * because a calculation from 2026 must keep using the 2026 rules forever.
 *
 * The `rationale` on each rule is what the UI shows next to that line of the
 * calculation, so a user can see why something counted.
 */

export const DEFAULT_RULE_SET_VERSION = '2026.1-default'

export async function seedRuleSets(prisma: PrismaClient) {
  const classicalSource = await prisma.source.upsert({
    where: { id: 'seed-source-classical-nisab' },
    update: {},
    create: {
      id: 'seed-source-classical-nisab',
      name: 'Klassieke nisab-maten (85 g goud / 595 g zilver)',
      organization: 'Interne regelbasis',
      sourceType: 'INTERNAL_RULE',
      url: null,
      lastVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    },
  })

  const ruleSet = await prisma.zakatRuleSet.upsert({
    where: { version: DEFAULT_RULE_SET_VERSION },
    update: { active: true },
    create: {
      version: DEFAULT_RULE_SET_VERSION,
      name: 'Standaardmethode',
      methodology: 'DEFAULT',
      zakatRate: '0.025',
      goldNisabGrams: '85',
      silverNisabGrams: '595',
      allowLiabilityDeduction: true,
      summary:
        'Transparante standaard: 2,5% over het netto Zakat-plichtig vermogen boven de nisab, ' +
        'met aftrek van verplichtingen die binnen twaalf maanden opeisbaar zijn.',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      active: true,
    },
  })

  await prisma.ruleSetSource.upsert({
    where: { ruleSetId_sourceId: { ruleSetId: ruleSet.id, sourceId: classicalSource.id } },
    update: {},
    create: {
      ruleSetId: ruleSet.id,
      sourceId: classicalSource.id,
      appliesTo: 'goldNisabGrams, silverNisabGrams',
    },
  })

  const assetRules = [
    {
      assetType: 'CASH' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Contant geld telt volledig mee.',
    },
    {
      assetType: 'BANK_ACCOUNT' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Saldo op je rekening telt volledig mee.',
    },
    {
      assetType: 'SAVINGS' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Spaargeld telt volledig mee.',
    },
    {
      assetType: 'GOLD' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Goud telt mee op basis van de waarde op je peildatum.',
    },
    {
      assetType: 'SILVER' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Zilver telt mee op basis van de waarde op je peildatum.',
    },
    {
      assetType: 'INVESTMENTS' as const,
      zakatable: true,
      pct: '100',
      rationale:
        'Beleggingen tellen standaard volledig mee. Wie een deel van de onderliggende ' +
        'bedrijfswaarde wil hanteren, kan het percentage per post aanpassen.',
    },
    {
      assetType: 'CRYPTO' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Crypto wordt behandeld als verhandelbaar bezit en telt volledig mee.',
    },
    {
      assetType: 'BUSINESS_CASH' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Zakelijke liquide middelen tellen volledig mee.',
    },
    {
      assetType: 'BUSINESS_INVENTORY' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Handelsvoorraad telt mee tegen de verkoopwaarde op je peildatum.',
    },
    {
      assetType: 'RECEIVABLES' as const,
      zakatable: true,
      pct: '100',
      rationale:
        'Vorderingen die je redelijkerwijs terugkrijgt tellen mee. Oninbare vorderingen kun je ' +
        'op 0% zetten.',
    },
    {
      assetType: 'PROPERTY_INVESTMENT' as const,
      zakatable: true,
      pct: '100',
      rationale:
        'Vastgoed dat je aanhoudt om te verhandelen telt mee. Vastgoed dat je verhuurt, telt ' +
        'niet zelf mee — de huurinkomsten zitten dan in je spaargeld.',
    },
    {
      assetType: 'OTHER' as const,
      zakatable: true,
      pct: '100',
      rationale: 'Overig bezit telt standaard mee; pas het percentage aan als dat niet klopt.',
    },
  ]

  for (const rule of assetRules) {
    await prisma.zakatAssetRule.upsert({
      where: { ruleSetId_assetType: { ruleSetId: ruleSet.id, assetType: rule.assetType } },
      update: {
        zakatable: rule.zakatable,
        defaultZakatablePercentage: rule.pct,
        rationale: rule.rationale,
      },
      create: {
        ruleSetId: ruleSet.id,
        assetType: rule.assetType,
        zakatable: rule.zakatable,
        defaultZakatablePercentage: rule.pct,
        rationale: rule.rationale,
      },
    })
  }

  const liabilityRules = [
    {
      liabilityType: 'SHORT_TERM_DEBT' as const,
      deductible: true,
      maxMonths: 12,
      rationale: 'Schulden die binnen twaalf maanden opeisbaar zijn, zijn aftrekbaar.',
    },
    {
      liabilityType: 'CREDIT_CARD' as const,
      deductible: true,
      maxMonths: 12,
      rationale: 'Openstaand kredietkaartsaldo is een korte termijn verplichting.',
    },
    {
      liabilityType: 'INVOICE_DUE' as const,
      deductible: true,
      maxMonths: 12,
      rationale: 'Facturen die je nog moet betalen zijn aftrekbaar.',
    },
    {
      liabilityType: 'TAX_DUE' as const,
      deductible: true,
      maxMonths: 12,
      rationale: 'Een belastingaanslag die al vaststaat is aftrekbaar.',
    },
    {
      liabilityType: 'BUSINESS_PAYABLE' as const,
      deductible: true,
      maxMonths: 12,
      rationale: 'Zakelijke verplichtingen op korte termijn zijn aftrekbaar.',
    },
    {
      liabilityType: 'OTHER' as const,
      deductible: false,
      maxMonths: null,
      rationale:
        'Overige verplichtingen zijn niet automatisch aftrekbaar. Zet ze per post aan als je ' +
        'weet dat ze binnen het jaar opeisbaar zijn.',
    },
  ]

  for (const rule of liabilityRules) {
    await prisma.zakatLiabilityRule.upsert({
      where: {
        ruleSetId_liabilityType: { ruleSetId: ruleSet.id, liabilityType: rule.liabilityType },
      },
      update: {
        deductibleByDefault: rule.deductible,
        maxMonthsAhead: rule.maxMonths,
        rationale: rule.rationale,
      },
      create: {
        ruleSetId: ruleSet.id,
        liabilityType: rule.liabilityType,
        deductibleByDefault: rule.deductible,
        maxMonthsAhead: rule.maxMonths,
        rationale: rule.rationale,
      },
    })
  }

  return ruleSet
}
