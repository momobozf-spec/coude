import { z } from "zod";

/** Verklaring van herroeping via de online herroepingsfunctie (zie src/app/api/withdrawal/route.ts). */
export const withdrawalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  orderNumber: z.string().trim().min(1).max(40),
  items: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => (v ? v : null)),
  confirm: z.literal(true),
});
