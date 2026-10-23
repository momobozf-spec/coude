import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PRODUCT_STATUSES } from "@/lib/status";
import { CLP_PICTOGRAMS } from "@/lib/productSafety";

/** Geeft de sessie terug als de gebruiker beheerder is, anders een kant-en-klaar foutantwoord. */
export async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Geen toegang — alleen beheerders" }, { status: 403 }) };
  }
  return { ok: true, userId: session.user.id };
}

const euro = z.coerce.number().finite().min(0).max(99_999.99);
const textList = (max: number) => z.array(z.string().trim().min(1).max(max)).max(30).default([]);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Velden die een beheerder op een product mag zetten. Alles daarbuiten wordt genegeerd. */
export const adminProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: kleine letters, cijfers en koppeltekens")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: z.string().trim().min(1).max(20_000),
  descriptionFr: nullableText(20_000),
  descriptionAr: nullableText(20_000),
  price: euro.refine((v) => v > 0, "Prijs moet groter dan 0 zijn"),
  comparePrice: z
    .union([euro, z.literal(""), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" && v > 0 ? v : null)),
  images: z.array(z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "Alleen https-afbeeldingen")).max(12).default([]),
  sizes: textList(40),
  colors: textList(40),
  materials: textList(60),
  gender: nullableText(20),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  status: z.enum(PRODUCT_STATUSES).default("ACTIVE"),
  featured: z.boolean().default(false),
  badge: nullableText(40),
  supplier: nullableText(200),
  // Productveiligheid (GPSR/CLP); verplicht voor actieve kaarsen en geurproducten, zie productSafety.ts.
  safetyInfo: nullableText(5000),
  safetyInfoFr: nullableText(5000),
  hazardPictograms: z.array(z.enum(CLP_PICTOGRAMS)).max(9).default([]),
  manufacturerInfo: nullableText(1000),
  euResponsiblePerson: nullableText(1000),
  categoryId: z.string().trim().min(1).max(64),
});

export type AdminProductInput = z.infer<typeof adminProductSchema>;

/**
 * Validatie voor een gedeeltelijke update (PATCH). Alleen de velden die de
 * aanroeper effectief meestuurt komen in het resultaat: standaardwaarden uit
 * het schema (images: [], status: ACTIVE, …) mogen bestaande gegevens nooit
 * stilletjes overschrijven. Onbekende velden worden geweigerd.
 */
export function parseAdminProductPatch(raw: unknown):
  | { success: true; data: Partial<AdminProductInput> }
  | { success: false; error: z.ZodError } {
  const parsed = adminProductSchema.partial().strict().safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  const sent = new Set(raw && typeof raw === "object" ? Object.keys(raw) : []);
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([key, value]) => sent.has(key) && value !== undefined),
  ) as Partial<AdminProductInput>;
  return { success: true, data };
}

/** Eerste validatiefout als leesbare tekst. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Ongeldige invoer";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
