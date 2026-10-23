import { z } from 'zod'

/**
 * Shared by the client form and the route handler, so the browser and the server
 * never disagree about what a valid registration looks like.
 */

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Vul je naam in.').max(120),
  email: z.string().trim().toLowerCase().email('Vul een geldig e-mailadres in.'),
  password: z
    .string()
    .min(10, 'Gebruik minstens 10 tekens.')
    .max(200, 'Dat wachtwoord is te lang.'),
  /**
   * Uitdrukkelijke toestemming (AVG art. 9(2)(a)): Zakat- en Sadaqah-gegevens
   * kunnen je religieuze overtuiging onthullen, een bijzondere categorie van
   * persoonsgegevens. Zonder deze toestemming geen account.
   */
  specialDataConsent: z.literal(true, {
    message: 'Geef je uitdrukkelijke toestemming om je account aan te maken.',
  }),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Vul een geldig e-mailadres in.'),
  password: z.string().min(1, 'Vul je wachtwoord in.'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ── Accountbeheer ────────────────────────────────────────────────────────────

const newPassword = z
  .string()
  .min(10, 'Gebruik minstens 10 tekens.')
  .max(200, 'Dat wachtwoord is te lang.')

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vul je huidige wachtwoord in.').max(200),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'De twee nieuwe wachtwoorden zijn niet gelijk.',
    path: ['confirmPassword'],
  })

export const resetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Vul een geldig e-mailadres in.'),
})

export const resetConfirmSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'De twee wachtwoorden zijn niet gelijk.',
    path: ['confirmPassword'],
  })

export const deleteAccountSchema = z.object({
  email: z.string().trim().min(1, 'Typ je e-mailadres ter bevestiging.'),
  password: z.string().max(200).optional(),
})
