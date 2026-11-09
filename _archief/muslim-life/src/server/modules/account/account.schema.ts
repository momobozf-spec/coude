import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(255),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200, 'That password is too long.'),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const INTEREST_VALUES = [
  'FAMILY',
  'FITNESS',
  'LEARNING',
  'BUSINESS',
  'TRAVEL',
  'MODEST_FASHION',
  'FOOD',
  'FINANCE',
] as const

export const GOAL_VALUES = [
  'PRAY_CONSISTENTLY',
  'READ_QURAN',
  'PRODUCTIVITY',
  'SAVE_MONEY',
  'LEARN',
  'BUILD_HABITS',
  'RAMADAN_PREP',
  'UMRAH_HAJJ',
  'FAMILY_ORG',
] as const

export type Interest = (typeof INTEREST_VALUES)[number]
export type UserGoal = (typeof GOAL_VALUES)[number]

export const CALCULATION_METHOD_VALUES = [
  'MUSLIM_WORLD_LEAGUE',
  'EGYPTIAN',
  'KARACHI',
  'UMM_AL_QURA',
  'DUBAI',
  'MOON_SIGHTING_COMMITTEE',
  'NORTH_AMERICA',
  'KUWAIT',
  'QATAR',
  'SINGAPORE',
  'TEHRAN',
  'TURKEY',
] as const

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(80),
  countryId: z.string().uuid('Please choose your country.'),
  cityId: z.string().uuid('Please choose your city.'),
  calculationMethod: z.enum(CALCULATION_METHOD_VALUES),
  madhab: z.enum(['SHAFI', 'HANAFI']),
  interests: z.array(z.enum(INTEREST_VALUES)).max(INTEREST_VALUES.length),
  goals: z.array(z.enum(GOAL_VALUES)).max(GOAL_VALUES.length),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
