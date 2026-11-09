/**
 * Demo-gegevens, herkenbaar gemarkeerd (is_demo, e-mails op klushulp.local, "Demo" in de naam).
 * Weigert zonder ALLOW_DEMO_DATA=true en altijd met NODE_ENV=production.
 * Idempotent: bestaande demo-accounts worden hergebruikt.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { seedCatalog } from "./seed-catalog";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_DATA !== "true") {
    throw new Error("Demo-seed geweigerd: zet ALLOW_DEMO_DATA=true (nooit in productie).");
  }
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10) throw new Error("DEMO_PASSWORD (min. 10 tekens) ontbreekt.");

  const { auth } = await import("../src/lib/auth");
  const { db, pool, schema } = await import("../src/db");
  await seedCatalog(db);

  const cats = await db.select().from(schema.category);
  const cat = (slug: string) => cats.find((c) => c.slug === slug)!;
  const munis = await db.select().from(schema.municipality);
  const muni = (pc: string) => munis.find((m) => m.postcode === pc)!;

  async function ensureUser(email: string, name: string, role: "admin" | "provider") {
    const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (u) return u;
    await auth.api.signUpEmail({ body: { name, email, password: password! } });
    await db.update(schema.user).set({ platformRole: role }).where(eq(schema.user.email, email));
    return (await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1))[0];
  }

  await ensureUser("beheer@klushulp.local", "Demo Beheerder", "admin");

  type DemoProvider = {
    email: string;
    name: string;
    business: string;
    kbo: string;
    cats: { slug: string; services: string }[];
    pc: string;
    radius: number;
    bio: string;
    hourly: number | null;
    travel: number;
    years: number;
    slots: [number, number, number][]; // weekday, start, end (minuten)
    insurance?: boolean;
  };

  const workdays = (start: number, end: number): [number, number, number][] => [1, 2, 3, 4, 5].map((d) => [d, start, end] as [number, number, number]);

  const providers: DemoProvider[] = [
    { email: "loodgieter1@klushulp.local", name: "Demo Loodgieter Berchem", business: "Demo Sanitair Berchem", kbo: "0999000001", cats: [{ slug: "plumbing", services: "Lekken herstellen, kranen vervangen, ontstoppen, boiler aansluiten" }], pc: "2600", radius: 15, bio: "Demoprofiel. Loodgieter met focus op herstellingen en kleine installaties in en rond Antwerpen.", hourly: 6500, travel: 2500, years: 12, slots: workdays(8 * 60, 17 * 60), insurance: true },
    { email: "loodgieter2@klushulp.local", name: "Demo Loodgieter Hoboken", business: "Demo Waterwerk Hoboken", kbo: "0999000002", cats: [{ slug: "plumbing", services: "Ontstoppingen, sanitair plaatsen, badkamer" }], pc: "2660", radius: 20, bio: "Demoprofiel. Ook op zaterdagvoormiddag beschikbaar.", hourly: 5900, travel: 0, years: 7, slots: [...workdays(9 * 60, 18 * 60), [6, 9 * 60, 13 * 60]] },
    { email: "elektricien1@klushulp.local", name: "Demo Elektricien Deurne", business: "Demo Elektro Deurne", kbo: "0999000003", cats: [{ slug: "electrical", services: "Stopcontacten, verlichting, zekeringkast, storingen" }], pc: "2100", radius: 15, bio: "Demoprofiel. Elektrische installaties en storingen, woningen en appartementen.", hourly: 7000, travel: 2000, years: 15, slots: workdays(7 * 60 + 30, 16 * 60 + 30), insurance: true },
    { email: "elektricien2@klushulp.local", name: "Demo Elektricien Mortsel", business: "Demo Volt Mortsel", kbo: "0999000004", cats: [{ slug: "electrical", services: "Laadpalen, keuringsklaar maken, verlichting" }, { slug: "handyman", services: "Ophangen van tv en verlichting" }], pc: "2640", radius: 12, bio: "Demoprofiel. Gespecialiseerd in laadpalen en keuringen; ook kleine montagewerken.", hourly: 7500, travel: 1500, years: 9, slots: [...workdays(8 * 60, 18 * 60), [3, 18 * 60, 21 * 60]] },
    { email: "klushulp1@klushulp.local", name: "Demo Klushulp Wilrijk", business: "Demo Montage Wilrijk", kbo: "0999000005", cats: [{ slug: "handyman", services: "Meubelmontage, ophangen, kleine herstellingen" }], pc: "2610", radius: 25, bio: "Demoprofiel. Montage en ophangwerk, ook 's avonds.", hourly: 4500, travel: 1000, years: 4, slots: [...workdays(17 * 60, 21 * 60), [6, 9 * 60, 17 * 60]] },
  ];

  for (const d of providers) {
    const u = await ensureUser(d.email, d.name, "provider");
    const [existing] = await db.select().from(schema.provider).where(eq(schema.provider.userId, u.id)).limit(1);
    if (existing) continue;
    const m = muni(d.pc);
    const [p] = await db
      .insert(schema.provider)
      .values({
        userId: u.id,
        type: "professional",
        displayName: d.business,
        businessName: d.business,
        kboNumber: d.kbo,
        bio: d.bio,
        basePostcode: m.postcode,
        baseMunicipality: m.nameNl,
        baseLat: m.lat,
        baseLng: m.lng,
        radiusKm: d.radius,
        hourlyRateCents: d.hourly,
        travelFeeCents: d.travel,
        yearsExperience: d.years,
        status: "active",
        isDemo: true,
      })
      .returning();
    await db.insert(schema.providerCategory).values(d.cats.map((c) => ({ providerId: p.id, categoryId: cat(c.slug).id, services: c.services })));
    await db.insert(schema.availabilitySlot).values(d.slots.map(([weekday, startMin, endMin]) => ({ providerId: p.id, weekday, startMin, endMin })));
    await db.insert(schema.providerVerification).values({ providerId: p.id, kind: "kbo", reference: d.kbo, status: "approved", note: "Demo: fictief nummer, niet gecontroleerd in KBO." });
    if (d.insurance) await db.insert(schema.providerVerification).values({ providerId: p.id, kind: "insurance", reference: "Demo-polis", status: "approved", note: "Demo." });
  }

  // Eén dienstverlener in afwachting van controle (voor het beheerscherm).
  const pendingUser = await ensureUser("wachtend@klushulp.local", "Demo Wachtend Vakbedrijf", "provider");
  const [pendingExisting] = await db.select().from(schema.provider).where(eq(schema.provider.userId, pendingUser.id)).limit(1);
  if (!pendingExisting) {
    const m = muni("2000");
    const [p] = await db
      .insert(schema.provider)
      .values({ userId: pendingUser.id, type: "professional", displayName: "Demo Wachtend Vakbedrijf", businessName: "Demo Wachtend Vakbedrijf", kboNumber: "0999000006", bio: "Demoprofiel in afwachting van controle.", basePostcode: m.postcode, baseMunicipality: m.nameNl, baseLat: m.lat, baseLng: m.lng, radiusKm: 10, status: "pending", isDemo: true })
      .returning();
    await db.insert(schema.providerCategory).values({ providerId: p.id, categoryId: cat("plumbing").id, services: "Demo" });
    await db.insert(schema.availabilitySlot).values(workdays(8 * 60, 17 * 60).map(([weekday, startMin, endMin]) => ({ providerId: p.id, weekday, startMin, endMin })));
    await db.insert(schema.providerVerification).values({ providerId: p.id, kind: "kbo", reference: "0999000006", status: "pending" });
  }

  console.log("Demo-accounts (wachtwoord = DEMO_PASSWORD):");
  console.log("  beheer@klushulp.local (beheer)");
  for (const d of providers) console.log(`  ${d.email} (dienstverlener)`);
  console.log("  wachtend@klushulp.local (dienstverlener, in afwachting)");
  console.log(`Catalogus klaar. Regio: Antwerpen (${cats.length} categorieën).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
