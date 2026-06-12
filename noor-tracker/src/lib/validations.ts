import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Naam moet minimaal 2 tekens bevatten"),
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens bevatten"),
});

export const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export const childSchema = z.object({
  name: z.string().min(1, "Naam is verplicht").max(50),
  age: z
    .number()
    .int()
    .min(4, "Noor Tracker is bedoeld voor kinderen vanaf 4 jaar.")
    .max(8, "Noor Tracker is gericht op kinderen tot en met 8 jaar."),
  avatar: z.string().default("star"),
});

export const habitLogSchema = z.object({
  habits: z.record(z.string(), z.boolean()),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type HabitLogInput = z.infer<typeof habitLogSchema>;
