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
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Vul een geldig e-mailadres in.'),
  password: z.string().min(1, 'Vul je wachtwoord in.'),
})

export type LoginInput = z.infer<typeof loginSchema>
