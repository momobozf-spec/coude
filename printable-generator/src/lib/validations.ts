import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be under 50 characters")
    .trim(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be under 100 characters"),
  // GDPR art. 8 / terms: the account holder must be an adult (parent, guardian or teacher)
  // and accept the terms and privacy policy.
  acceptTerms: z.literal(true, { error: "Please confirm you are 18+ and accept the terms and privacy policy" }),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export const generateSchema = z.object({
  activityType: z.enum(["coloring", "maze", "wordsearch"], {
    error: "Invalid activity type",
  }),
  theme: z
    .string()
    .min(1, "Theme is required")
    .max(100, "Theme must be under 100 characters")
    .trim(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GenerateInput = z.infer<typeof generateSchema>;
