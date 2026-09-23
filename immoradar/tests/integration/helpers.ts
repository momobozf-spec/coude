import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { normalizeTerritoryValue } from "@/domain/territory/territory-matcher";

export async function createAgency(db: PrismaClient, name: string, territories: Array<{ type: "POSTAL_CODE" | "MUNICIPALITY" | "PROVINCE"; value: string }>, over: Record<string, unknown> = {}) {
  const agency = await db.agency.create({
    data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), alertMinScore: 80, telegramChatId: `chat-${name}`, ...over },
  });
  for (const t of territories) {
    await db.territory.create({ data: { agencyId: agency.id, type: t.type, value: t.value, normalizedValue: normalizeTerritoryValue(t.type, t.value) } });
  }
  return agency;
}

export async function createUser(db: PrismaClient, agencyId: string | null, name: string, role: Role = "AGENT", over: Record<string, unknown> = {}) {
  return db.user.create({
    data: { agencyId, name, email: `${name.toLowerCase().replace(/\s+/g, ".")}.${Math.random().toString(36).slice(2, 7)}@example.test`, passwordHash: await hashPassword("password123"), role, ...over },
  });
}

export const PIETER_CSV = `id;voornaam;naam;gsm;email;adres;postcode;gemeente;makelaar;type;status;laatste contact;relatie;jaar;pand adres;pand postcode
C-1001;Pieter;Janssens;0478 12 34 56;pieter.janssens@telenet.be;Kortrijksesteenweg 123;9000;Gent;Thomas;Koper;Gewonnen;15/03/2019;gekocht;2019;Kortrijksesteenweg 123;9000
C-1002;Marie;Dubois;0499 11 22 33;marie.dubois@gmail.com;Zwijnaardsesteenweg 55;9000;Gent;Sofie;Schatting;Open;10/12/2024;schatting;2024;Zwijnaardsesteenweg 55;9000
C-1003;Karel;De Smet;0475 11 22 33;;Brusselsesteenweg 210;9090;Melle;Thomas;Verkoper;Verloren;01/02/2025;;;;
`;
