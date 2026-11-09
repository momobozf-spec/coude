/**
 * De onboarding, als data.
 *
 * Vijf stappen. De vorm van elke stap staat hier als Zod-schema, en dát is de
 * bron van waarheid: de wizard leest eruit welke velden er zijn, de server
 * valideert ermee, en het opgeslagen JSON-document wordt ermee gecontroleerd
 * bij het teruglezen. Eén definitie kan niet uit elkaar lopen met zichzelf.
 *
 * ─── HERVATBAAR ──────────────────────────────────────────────────────────────
 *
 * Elke stap wordt apart opgeslagen. `User.onboardingStep` houdt bij hoever
 * iemand is; `User.onboarding` bevat de antwoorden tot nu toe. Wie halverwege
 * afhaakt en morgen terugkomt, gaat verder waar hij was — dat is geen extraatje
 * maar de reden dat mensen een wizard van vijf stappen afmaken.
 *
 * Daarom is elk stapschema apart valideerbaar, en is het volledige document een
 * partial: een half ingevulde onboarding is een geldige toestand.
 */
import { z } from 'zod'
import {
  OnboardingGoal,
  PurchaseTimeline,
  PurchaseType,
} from '@prisma/client'

import { MAX_AMOUNT_CENTS } from '@/lib/money'
import { BE_REGIONS } from '@/config/public'

// ─────────────────────────────────────────────────────────────────────────────
// Stap 1 — Doel
// ─────────────────────────────────────────────────────────────────────────────

export const goalStepSchema = z.object({
  goal: z.enum(OnboardingGoal),
})

export const GOAL_OPTIONS = [
  {
    value: OnboardingGoal.ORIENTING,
    label: 'Ik ben me nog aan het oriënteren',
    description: 'Je wil weten wat er mogelijk is en wat een aankoop inhoudt.',
  },
  {
    value: OnboardingGoal.READY_TO_BUY,
    label: 'Ik wil een woning kopen',
    description: 'Je bent klaar om te zoeken en je financiering te regelen.',
  },
  {
    value: OnboardingGoal.FOUND_PROPERTY,
    label: 'Ik heb al een woning gevonden',
    description: 'Je weet welke woning je wil en moet de rest nog regelen.',
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Stap 2 — Locatie
// ─────────────────────────────────────────────────────────────────────────────

export const locationStepSchema = z.object({
  // Voor de MVP alleen België. Het veld staat er wél, zodat uitbreiden geen
  // schemawijziging is.
  country: z.literal('BE').default('BE'),
  region: z.enum(BE_REGIONS),
  city: z.string().trim().min(1, 'Vul een gemeente in').max(120),
  postalCode: z
    .string()
    .regex(/^\d{4}$/, 'Een Belgische postcode heeft vier cijfers')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  radiusKm: z.coerce.number().int().min(1).max(100).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Stap 3 — Budget
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bedragen komen als centen binnen. De formulierlaag zet de getypte tekst om
 * met `parseAmountToCents`, zodat hier nooit "450.000" als string aankomt.
 */
const amountCents = z.number().int().min(0).max(MAX_AMOUNT_CENTS)

export const budgetStepSchema = z
  .object({
    maxBudgetCents: amountCents,
    ownFundsCents: amountCents,
    /** Null = onzeker. Een geldig antwoord, en iets anders dan "nee". */
    needsFinancing: z.boolean().nullable().default(null),
    purchaseType: z.enum(PurchaseType).default(PurchaseType.EXISTING),
    firstHome: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.ownFundsCents > value.maxBudgetCents) {
      ctx.addIssue({
        code: 'custom',
        path: ['ownFundsCents'],
        message: 'Je eigen middelen kunnen niet hoger zijn dan je budget',
      })
    }
    // Wie zijn hele aankoop uit eigen middelen betaalt, heeft geen financiering
    // nodig. Dat expliciet weigeren voorkomt een traject dat om documenten
    // vraagt die nergens voor dienen.
    if (value.needsFinancing === true && value.ownFundsCents === value.maxBudgetCents) {
      ctx.addIssue({
        code: 'custom',
        path: ['needsFinancing'],
        message:
          'Je eigen middelen dekken de volledige aankoop — dan heb je geen financiering nodig',
      })
    }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Stap 4 — Timing
// ─────────────────────────────────────────────────────────────────────────────

export const timingStepSchema = z.object({
  timeline: z.enum(PurchaseTimeline),
})

export const TIMELINE_OPTIONS = [
  { value: PurchaseTimeline.ASAP, label: 'Zo snel mogelijk', months: 1 },
  { value: PurchaseTimeline.WITHIN_3_MONTHS, label: 'Binnen 3 maanden', months: 3 },
  { value: PurchaseTimeline.WITHIN_6_MONTHS, label: 'Binnen 6 maanden', months: 6 },
  { value: PurchaseTimeline.WITHIN_12_MONTHS, label: 'Binnen 12 maanden', months: 12 },
  { value: PurchaseTimeline.NO_DEADLINE, label: 'Nog geen deadline', months: null },
] as const

/** De streefdatum die uit een gekozen termijn volgt. Null bij geen deadline. */
export function targetDateFor(timeline: PurchaseTimeline, from: Date): Date | null {
  const option = TIMELINE_OPTIONS.find((o) => o.value === timeline)
  if (!option?.months) return null

  const target = new Date(from)
  target.setMonth(target.getMonth() + option.months)
  return target
}

// ─────────────────────────────────────────────────────────────────────────────
// Stap 5 — Prioriteiten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prioriteiten als lijst van sleutels met een gewicht, niet als twintig losse
 * booleans.
 *
 * Reden: een nieuwe prioriteit toevoegen mag geen migratie zijn, en de
 * buurtscore werkt al met gewichten 0-4. Eén vorm die beide bedient.
 */
export const PRIORITY_KEYS = [
  'halal_financing',
  'low_monthly_payment',
  'energy_efficient',
  'mosque_nearby',
  'schools_nearby',
  'public_transport',
  'garden',
  'parking',
] as const

export type PriorityKey = (typeof PRIORITY_KEYS)[number]

export const PRIORITY_OPTIONS: { value: PriorityKey; label: string; hint: string }[] = [
  {
    value: 'halal_financing',
    label: 'Halal financiering',
    hint: 'We tonen financieringsvormen met hun herkomst en bron.',
  },
  { value: 'low_monthly_payment', label: 'Lage maandlast', hint: 'Weegt mee in de vergelijking.' },
  { value: 'energy_efficient', label: 'Energiezuinig', hint: 'Filtert op EPC-label.' },
  { value: 'mosque_nearby', label: 'Moskee dichtbij', hint: 'Weegt mee in je buurtscore.' },
  { value: 'schools_nearby', label: 'Scholen dichtbij', hint: 'Weegt mee in je buurtscore.' },
  { value: 'public_transport', label: 'Openbaar vervoer', hint: 'Weegt mee in je buurtscore.' },
  { value: 'garden', label: 'Tuin', hint: 'Wordt een voorkeur in je zoekopdracht.' },
  { value: 'parking', label: 'Parking of garage', hint: 'Wordt een voorkeur in je zoekopdracht.' },
]

export const prioritiesStepSchema = z.object({
  priorities: z.array(z.enum(PRIORITY_KEYS)).max(PRIORITY_KEYS.length).default([]),
})

// ─────────────────────────────────────────────────────────────────────────────
// Het geheel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Het opgeslagen document. Alles optioneel, want een half ingevulde onboarding
 * is een geldige toestand.
 */
export const onboardingDraftSchema = z.object({
  goal: goalStepSchema.shape.goal.optional(),

  country: z.string().optional(),
  region: locationStepSchema.shape.region.optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  radiusKm: z.number().int().optional(),

  maxBudgetCents: z.number().int().optional(),
  ownFundsCents: z.number().int().optional(),
  needsFinancing: z.boolean().nullable().optional(),
  purchaseType: z.enum(PurchaseType).optional(),
  firstHome: z.boolean().optional(),

  timeline: z.enum(PurchaseTimeline).optional(),

  priorities: z.array(z.enum(PRIORITY_KEYS)).optional(),
})

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>

/** De volgorde van de stappen. De index hierin is `User.onboardingStep`. */
export const ONBOARDING_STEPS = [
  { step: 1, key: 'goal', title: 'Wat wil je doen?', schema: goalStepSchema },
  { step: 2, key: 'location', title: 'Waar wil je kopen?', schema: locationStepSchema },
  { step: 3, key: 'budget', title: 'Wat is je budget?', schema: budgetStepSchema },
  { step: 4, key: 'timing', title: 'Wanneer wil je kopen?', schema: timingStepSchema },
  {
    step: 5,
    key: 'priorities',
    title: 'Wat vind je belangrijk?',
    schema: prioritiesStepSchema,
  },
] as const

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key']

export function stepDefinition(step: number) {
  return ONBOARDING_STEPS.find((s) => s.step === step) ?? null
}

/**
 * Is de onboarding compleet genoeg om een traject aan te maken?
 *
 * Prioriteiten ontbreken mag: dat is een verrijking, geen voorwaarde. De rest
 * bepaalt de startfase, het budget en de checklists, en is dus wel nodig.
 */
export function isDraftComplete(draft: OnboardingDraft): boolean {
  return (
    draft.goal !== undefined &&
    draft.region !== undefined &&
    draft.city !== undefined &&
    draft.maxBudgetCents !== undefined &&
    draft.ownFundsCents !== undefined &&
    draft.timeline !== undefined
  )
}

/** De eerste stap die nog niet is ingevuld. `TOTAL + 1` wanneer alles klaar is. */
export function firstIncompleteStep(draft: OnboardingDraft): number {
  if (draft.goal === undefined) return 1
  if (draft.region === undefined || draft.city === undefined) return 2
  if (draft.maxBudgetCents === undefined || draft.ownFundsCents === undefined) return 3
  if (draft.timeline === undefined) return 4
  if (draft.priorities === undefined) return 5
  return TOTAL_ONBOARDING_STEPS + 1
}
