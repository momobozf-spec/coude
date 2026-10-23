import type { DB } from "@/db";
import { source } from "@/db/schema";

export const SOURCE_DEFS = [
  {
    id: "ted",
    name: "TED (Tenders Electronic Daily) — Search API v3",
    automation: "api",
    coverageNote:
      "Europese bekendmakingen in het Publicatieblad (OJ S). Belgische opdrachten boven de Europese drempels en vrijwillige Europese publicaties. Opdrachten die enkel nationaal (e-Notification/Publicprocurement.be) gepubliceerd worden, zitten hier NIET in. Zoekfilter: land opdrachtgever BEL + CPV 72*/48* of gecontroleerde zoektermen.",
  },
  {
    id: "be-eprocurement",
    name: "Belgische e-Procurement (publicprocurement.be) — handmatige invoer",
    automation: "manual",
    coverageNote:
      "Geen gedocumenteerde en toegestane publieke API of export bevestigd (onderzocht 23-10-2026). Enkel wat de beheerder handmatig invoert: bronlink, gegevens en rechtmatig beschikbare documenten. Geen automatische dekking.",
  },
  {
    id: "manual",
    name: "Andere bron — handmatige invoer",
    automation: "manual",
    coverageNote: "Opdrachten die de beheerder handmatig toevoegt vanuit een andere openbare of rechtmatig aangeleverde bron.",
  },
  {
    id: "demo",
    name: "Demo (herkenbaar fictief)",
    automation: "manual",
    coverageNote: "Fictieve gegevens uitsluitend voor demo's en tests. Nooit gemengd met live opdrachten.",
  },
] as const;

export async function ensureSources(database: DB) {
  for (const s of SOURCE_DEFS) {
    await database
      .insert(source)
      .values({ id: s.id, name: s.name, automation: s.automation, coverageNote: s.coverageNote })
      .onConflictDoUpdate({ target: source.id, set: { name: s.name, automation: s.automation, coverageNote: s.coverageNote } });
  }
}
