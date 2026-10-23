import { z } from 'zod'

/**
 * Charity directory and admin input validation (§21, §29).
 */

export const charitySortEnum = z.enum(['name', 'recent', 'transparency'])

export const charityFilterSchema = z.object({
  country: z.string().trim().length(2).toUpperCase().optional(),
  cause: z.string().trim().max(60).optional(),
  search: z.string().trim().max(120).optional(),

  acceptsZakat: z.coerce.boolean().optional(),
  zakatPolicyPublished: z.coerce.boolean().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  favoritesOnly: z.coerce.boolean().optional(),

  organizationType: z
    .enum(['MOSQUE', 'FOUNDATION', 'NONPROFIT', 'COMPANY', 'OTHER'])
    .optional(),
  scope: z.enum(['LOCAL', 'NATIONAL', 'INTERNATIONAL']).optional(),

  /** Demo records stay hidden unless deliberately requested. */
  includeDemo: z.coerce.boolean().optional(),

  sort: charitySortEnum.default('name'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(20),
})

export type CharityFilterPayload = z.infer<typeof charityFilterSchema>

// ── Admin input ──────────────────────────────────────────────────────────────

export const charitySourceTypeEnum = z.enum([
  'GOVERNMENT_REGISTER',
  'AUDITED_REPORT',
  'INDEPENDENT_REVIEW',
  'FINANCIAL_REPORT',
  'ANNUAL_REPORT',
  'ZAKAT_POLICY',
  'OFFICIAL_WEBSITE',
  'OTHER',
])

export const charityClaimTypeEnum = z.enum([
  'REGISTERED_ENTITY',
  'CONTACT_DETAILS_PUBLISHED',
  'GOVERNANCE_DISCLOSED',
  'ANNUAL_REPORT_PUBLISHED',
  'FINANCIAL_STATEMENTS_PUBLISHED',
  'AUDITOR_DISCLOSED',
  'ADMIN_COST_DISCLOSED',
  'IMPACT_REPORT_PUBLISHED',
  'ACCEPTS_ZAKAT',
  'ZAKAT_POLICY_PUBLISHED',
  'ZAKAT_ALLOCATION_DESCRIBED',
  'ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED',
  'OPERATES_IN_COUNTRY',
])

export const upsertSourceSchema = z.object({
  sourceType: charitySourceTypeEnum,
  sourceUrl: z.string().trim().url('Vul een geldige URL in.'),
  title: z.string().trim().min(1).max(200),
  publisher: z.string().trim().max(160).nullable().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  retrievedAt: z.coerce.date().nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export type UpsertSourcePayload = z.infer<typeof upsertSourceSchema>

export const upsertClaimSchema = z.object({
  type: charityClaimTypeEnum,
  value: z.enum(['YES', 'NO', 'UNKNOWN']),
  status: z.enum(['UNVERIFIED', 'SELF_REPORTED', 'VERIFIED', 'DISPUTED']),
  valueText: z.string().trim().max(160).nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
})

export type UpsertClaimPayload = z.infer<typeof upsertClaimSchema>

export const verifyClaimSchema = z.object({
  sourceId: z.string().uuid(),
  note: z.string().trim().max(1000).nullable().optional(),
})

export const setVerificationSchema = z.object({
  verified: z.boolean(),
  reason: z.string().trim().max(300).optional(),
})
