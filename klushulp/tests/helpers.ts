import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedCatalog } from "../scripts/seed-catalog";

export async function resetDb() {
  // Volgorde respecteert foreign keys via CASCADE.
  await db.execute(`TRUNCATE "event", "submission_log", "report", "review", "message", "booking", "proposal", "request_match", "job_photo", "job_request", "time_off", "availability_slot", "provider_verification", "provider_category", "provider", "platform_setting", "session", "account", "verification", "user" RESTART IDENTITY CASCADE`);
  await seedCatalog(db);
}

let n = 0;
export async function makeUser(role: "provider" | "admin" | "customer" = "provider") {
  const id = `u_${++n}_${Date.now()}`;
  const [u] = await db.insert(schema.user).values({ id, name: `Test ${id}`, email: `${id}@test.local`, platformRole: role }).returning();
  return u;
}

export async function cat(slug: string) {
  const [c] = await db.select().from(schema.category).where(eq(schema.category.slug, slug)).limit(1);
  return c;
}

const workdays = [1, 2, 3, 4, 5];

/** Actieve dienstverlener met werkdagen 8–17 u. */
export async function makeProvider(opts: { postcode?: string; radiusKm?: number; categories?: string[]; status?: "active" | "pending" | "draft" | "suspended"; slots?: [number, number, number][] } = {}) {
  const u = await makeUser("provider");
  const [m] = await db.select().from(schema.municipality).where(eq(schema.municipality.postcode, opts.postcode ?? "2600")).limit(1);
  const [p] = await db
    .insert(schema.provider)
    .values({ userId: u.id, type: "professional", displayName: `Provider ${u.id}`, kboNumber: "0999999999", bio: "test", basePostcode: m.postcode, baseMunicipality: m.nameNl, baseLat: m.lat, baseLng: m.lng, radiusKm: opts.radiusKm ?? 15, status: opts.status ?? "active" })
    .returning();
  for (const slug of opts.categories ?? ["plumbing"]) {
    const c = await cat(slug);
    await db.insert(schema.providerCategory).values({ providerId: p.id, categoryId: c.id, services: "" });
  }
  const slots = opts.slots ?? workdays.map((d) => [d, 8 * 60, 17 * 60] as [number, number, number]);
  if (slots.length) await db.insert(schema.availabilitySlot).values(slots.map(([weekday, startMin, endMin]) => ({ providerId: p.id, weekday, startMin, endMin })));
  await db.insert(schema.providerVerification).values({ providerId: p.id, kind: "kbo", reference: "0999999999", status: "approved" });
  return { user: u, provider: p };
}

export function nextWeekday(from = new Date(), daysAhead = 2): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const baseRequest = {
  categorySlug: "plumbing",
  description: "De keukenkraan lekt al twee dagen en druppelt continu.",
  answers: {},
  postcode: "2600",
  municipality: "Berchem",
  streetAddress: "Teststraat 1",
  dateFrom: "",
  dateTo: "",
  timePreference: "any" as const,
  urgent: false,
  contactName: "Test Klant",
  contactEmail: "klant@test.local",
  contactPhone: "0470000000",
  locale: "nl" as const,
  consent: true as const,
  photoPaths: [],
};
