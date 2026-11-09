import { describe, expect, it } from "vitest";
import { parseFreeTextDeadline, parseTedDateTime, zonedToUtc } from "@/lib/time";
import { mapTedNotice } from "@/lib/ted/map";
import { buildTedQuery } from "@/lib/ted/query";
import { tedSearchAll, tedSearchPage } from "@/lib/ted/client";
import { quoteFound, verifyExtraction } from "@/lib/ai/verify";
import { isPublicAddress, validateFetchUrl } from "@/lib/net/safe-fetch";
import { lifecycleFromNotice, deriveLifecycle } from "@/lib/domain/lifecycle";
import { isPotentiallyRelevant } from "@/lib/domain/catalog";
import { checkPublishable } from "@/lib/domain/publication";
import { sniffType } from "@/lib/documents/text";

describe("tijd en deadlines", () => {
  it("TED datum+tijd met offset ⇒ exact tijdstip; oorspronkelijke waarde blijft bewaard", () => {
    const p = parseTedDateTime("2026-11-20+01:00", "10:00:00+01:00");
    expect(p.instant?.toISOString()).toBe("2026-11-20T09:00:00.000Z");
    expect(p.raw).toBe("2026-11-20+01:00 10:00:00+01:00");
  });
  it("TED datum zonder tijd ⇒ geen tijdstip geraden", () => {
    const p = parseTedDateTime("2026-11-20+01:00", null);
    expect(p.instant).toBeNull();
    expect(p.date).toBe("2026-11-20");
    expect(p.timeKnown).toBe(false);
  });
  it("vrije tekst zonder tijdzone ⇒ geen tijdzone geraden", () => {
    const p = parseFreeTextDeadline("20/11/2026 om 11u00");
    expect(p.time).toBe("11:00");
    expect(p.timezoneKnown).toBe(false);
    expect(p.instant).toBeNull();
  });
  it("vrije tekst met expliciete Belgische tijd ⇒ correct UTC-tijdstip (wintertijd)", () => {
    const p = parseFreeTextDeadline("20/11/2026 om 11u00 (Belgische tijd)");
    expect(p.instant?.toISOString()).toBe("2026-11-20T10:00:00.000Z");
  });
  it("zomertijd wordt correct verwerkt", () => {
    expect(zonedToUtc(2026, 7, 1, 10, 0, "Europe/Brussels").toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });
});

// Testfixtures opgebouwd volgens het officiële antwoordschema NoticeResponse (OP-TED/tedapi-docs v3.0):
// i18n-velden als {taalcode(ISO 639-2): tekst | tekst[]}, notice-version integer, publication-date array, bedragen als number.
// Herkenbaar fictief: geen echte TED-publicaties.
const fixture = (o: Record<string, unknown> = {}) => ({
  "publication-number": "999001-2026",
  "notice-identifier": "11111111-aaaa-4aaa-8aaa-000000000001",
  "notice-version": 1,
  "procedure-identifier": "22222222-bbbb-4bbb-8bbb-000000000002",
  "notice-type": "cn-standard",
  "form-type": "competition",
  "publication-date": ["2026-10-20+02:00"],
  "notice-title": { nld: "TESTFIXTURE — Raamovereenkomst dataplatform", fra: "TESTFIXTURE — Accord-cadre plateforme de données" },
  "buyer-name": { nld: ["TESTFIXTURE Overheidsdienst"] },
  "title-lot": { nld: ["Platform", "Rapportering"], fra: ["Plateforme", "Rapports"] },
  "place-of-performance-subdiv-proc": ["BE24"],
  "place-of-performance-country-proc": ["BEL"],
  "buyer-country": ["BEL"],
  "classification-cpv": ["72300000", "72316000"],
  "official-language": ["NLD", "FRA"],
  "identifier-lot": ["LOT-0001", "LOT-0002"],
  "deadline-receipt-tender-date-lot": ["2026-12-01+01:00", "2026-12-08+01:00"],
  "deadline-receipt-tender-time-lot": ["10:00:00+01:00", "14:00:00+01:00"],
  "estimated-value-lot": [400000, 250000],
  "estimated-value-cur-lot": ["EUR", "EUR"],
  "framework-maximum-value-lot": [2000000],
  links: { html: { NLD: "https://ted.europa.eu/nl/notice/-/detail/999001-2026" } },
  ...o,
});

describe("TED-mapping", () => {
  it("percelen behouden eigen deadlines en waarden (positioneel enkel bij gelijke aantallen)", () => {
    const m = mapTedNotice(fixture());
    const dl = m.facts.filter((f) => f.key === "submission_deadline");
    expect(dl.map((f) => [f.lotKey, f.parsedDeadline?.instant?.toISOString()])).toEqual([
      ["LOT-0001", "2026-12-01T09:00:00.000Z"],
      ["LOT-0002", "2026-12-08T13:00:00.000Z"],
    ]);
    expect(m.facts.filter((f) => f.key === "lot_value").map((f) => f.lotKey)).toEqual(["LOT-0001", "LOT-0002"]);
    // 1 waarde voor 2 percelen ⇒ niet geraden, procedureniveau + waarschuwing
    const fw = m.facts.find((f) => f.key === "framework_max_value")!;
    expect(fw.lotKey).toBeNull();
    expect(m.warnings.join(" ")).toMatch(/toewijzing per perceel onzeker/);
  });
  it("meertalige titel: Nederlands heeft voorrang, oorspronkelijke taal wordt bewaard", () => {
    const m = mapTedNotice(fixture());
    expect(m.title).toMatch(/Raamovereenkomst/);
    expect(m.titleLanguage).toBe("NLD");
    expect(m.buyerCountries).toEqual(["BEL"]);
    expect(m.performanceNuts).toEqual(["BE24"]); // plaats van uitvoering apart van land opdrachtgever
    expect(m.lots.map((l) => l.title)).toEqual(["Platform", "Rapportering"]); // talen niet door elkaar
    expect(mapTedNotice(fixture({ "place-of-performance-subdiv-proc": undefined, "place-of-performance-country-proc": undefined })).performanceNuts).toEqual([]);
  });
  it("tijden die niet aligneren met datums ⇒ tijdstip onbekend", () => {
    const m = mapTedNotice(fixture({ "deadline-receipt-tender-time-lot": ["10:00:00+01:00"] }));
    expect(m.facts.filter((f) => f.key === "submission_deadline").every((f) => f.parsedDeadline?.instant === null)).toBe(true);
  });
  it("intrekkings- en schorsingssignalen volgens codelijst change-corrig-justification", () => {
    expect(mapTedNotice(fixture({ "change-reason-code": "cancel" })).cancelled).toBe(true);
    const ci = mapTedNotice(fixture({ "change-reason-code": "cancel-intent" }));
    expect(ci.cancelled).toBe(false);
    expect(ci.suspended).toBe(true);
    expect(mapTedNotice(fixture({ "competition-termination-proc": true })).cancelled).toBe(true);
    expect(mapTedNotice(fixture({ "change-notice-version-identifier": "abc-01" })).isChange).toBe(true);
  });
  it("query bevat land, periode, CPV en aparte FT-clausules", () => {
    const q = buildTedQuery({ from: new Date("2026-07-25T00:00:00Z"), to: new Date("2026-10-23T00:00:00Z") });
    expect(q).toContain("buyer-country=BEL");
    expect(q).toContain("publication-date>=20260725");
    expect(q).toContain("classification-cpv=72*");
    expect(q).toContain('FT~("Power BI")');
    expect(q).toMatch(/SORT BY publication-number ASC$/);
  });
});

describe("TED-veldbeheer", () => {
  it("herkent door TED geweigerde velden in een 400-antwoord", async () => {
    const { rejectedFieldsFromError } = await import("@/lib/ted/fields");
    const body = JSON.stringify({ type: "QUERY_UNKNOWN_FIELD", fieldName: "duration-period-unit-lot" });
    expect(rejectedFieldsFromError(body, ["duration-period-unit-lot", "duration-period-value-lot", "notice-title"])).toEqual(["duration-period-unit-lot"]);
  });
});

describe("TED-client", () => {
  it("probeert opnieuw bij 429/5xx en volgt iteratietokens tot een lege pagina", async () => {
    const calls: unknown[] = [];
    const responses = [
      new Response("busy", { status: 503 }),
      Response.json({ notices: [fixture()], totalNoticeCount: 2, iterationNextToken: "t1", timedOut: false }),
      Response.json({ notices: [fixture({ "publication-number": "999002-2026" })], totalNoticeCount: 2, iterationNextToken: "t2", timedOut: false }),
      Response.json({ notices: [], totalNoticeCount: 2, iterationNextToken: null, timedOut: false }),
    ];
    const got: string[] = [];
    const res = await tedSearchAll(
      { query: "q", fields: ["publication-number"], limit: 1 },
      async (ns) => {
        got.push(...ns.map((n) => String(n["publication-number"])));
      },
      {
        fetchImpl: async (_u, init) => {
          calls.push(JSON.parse(String(init.body)));
          return responses.shift()!;
        },
        sleep: async () => {},
        delayMs: 0,
      },
    );
    expect(got).toEqual(["999001-2026", "999002-2026"]);
    expect(res.totalNoticeCount).toBe(2);
    expect((calls[2] as { iterationNextToken: string }).iterationNextToken).toBe("t1");
  });
  it("timedOut=true wordt niet als geldige pagina aanvaard", async () => {
    let i = 0;
    await expect(
      tedSearchPage({}, { fetchImpl: async () => { i++; return Response.json({ notices: [], timedOut: true }); }, sleep: async () => {}, maxRetries: 1 }),
    ).rejects.toThrow(/timedOut/);
    expect(i).toBe(2);
  });
  it("4xx wordt niet herhaald en geeft de fout zichtbaar terug", async () => {
    await expect(
      tedSearchPage({}, { fetchImpl: async () => new Response("unknown field", { status: 400 }), sleep: async () => {} }),
    ).rejects.toThrow(/400/);
  });
});

describe("levensfase", () => {
  it("mapt notice-types conservatief", () => {
    expect(lifecycleFromNotice("pin-only", "planning")).toBe("prior_information");
    expect(lifecycleFromNotice("pin-cfc-standard", null)).toBe("prior_information");
    expect(lifecycleFromNotice("cn-standard", "competition")).toBe("open");
    expect(lifecycleFromNotice("can-standard", "result")).toBe("awarded");
    expect(lifecycleFromNotice("cn-standard", "change")).toBe("change");
    expect(lifecycleFromNotice("pmc", "consultation")).toBe("prior_information");
    expect(lifecycleFromNotice("compl", "completion")).toBe("awarded");
    expect(lifecycleFromNotice("veat", "dir-awa-pre")).toBe("awarded");
    expect(lifecycleFromNotice("cn-social", "competition")).toBe("open");
  });
  it("wijzigingsbericht verandert de fase niet; gunning wint van oproep; intrekking wint van alles", () => {
    expect(deriveLifecycle([{ noticeType: "cn-standard" }, { noticeType: "cn-standard", formType: "change" }])).toBe("open");
    expect(deriveLifecycle([{ noticeType: "cn-standard" }, { noticeType: "can-standard" }])).toBe("awarded");
    expect(deriveLifecycle([{ noticeType: "cn-standard" }, { noticeType: "cn-standard", cancelled: true }])).toBe("cancelled");
    expect(deriveLifecycle([{ noticeType: "cn-standard" }, { noticeType: "cn-standard", suspended: true }])).toBe("unknown");
  });
});

describe("AI-bewijscontrole", () => {
  const docs = new Map([["d1", { pages: ["Inleiding", "De offertes moeten ten laatste op 20 november 2026 om 11.00 uur worden ingediend."], textStatus: "ok" }]]);
  it("citaat moet letterlijk in het document staan", () => {
    expect(quoteFound("ten laatste op 20 november 2026 om 11.00 uur", docs.get("d1")!.pages, null)).toEqual({ found: true, page: 2 });
    expect(quoteFound("ten laatste op 21 november 2026", docs.get("d1")!.pages, null).found).toBe(false);
  });
  it("verzonnen waarde of citaat ⇒ evidence_not_found", () => {
    const v = verifyExtraction(
      {
        source_language: "nl",
        summary_nl: "x",
        summary_is_translation: false,
        lots: [],
        facts: [
          { key: "submission_deadline", lot_key: null, raw_value: "20 november 2026 11.00", value_number: null, unit: null, evidence: { document_id: "d1", page: 2, section: null, quote: "ten laatste op 20 november 2026 om 11.00 uur" } },
          { key: "estimated_value", lot_key: null, raw_value: "500000 EUR", value_number: 500000, unit: "EUR", evidence: { document_id: "d1", page: 2, section: null, quote: "De geraamde waarde bedraagt 500.000 EUR" } },
        ],
        requirements: [],
        missing: [],
      },
      docs,
    );
    expect(v.facts[0].verificationStatus).toBe("unverified");
    expect(v.facts[1].verificationStatus).toBe("evidence_not_found");
  });
});

describe("SSRF-bescherming", () => {
  it("weigert privé/gereserveerde adressen en niet-https", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1", "100.64.0.1", "0.0.0.0"]) expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(() => validateFetchUrl("http://example.org/a.pdf")).toThrow(/https/);
    expect(() => validateFetchUrl("https://127.0.0.1/a.pdf")).toThrow();
    expect(() => validateFetchUrl("https://[::1]/a.pdf")).toThrow();
    expect(() => validateFetchUrl("https://user:pw@example.org/a.pdf")).toThrow(/inloggegevens/);
    expect(() => validateFetchUrl("https://example.org:8443/a.pdf")).toThrow(/443/);
    expect(() => validateFetchUrl("https://metadata.internal/x")).toThrow();
    expect(validateFetchUrl("https://example.org/a.pdf").hostname).toBe("example.org");
  });
  it("bestandstype wordt op inhoud gecontroleerd, niet op opgegeven type", () => {
    expect(sniffType(Buffer.from("%PDF-1.7 ..."), "application/octet-stream")).toBe("application/pdf");
    expect(sniffType(Buffer.from("MZ\0\0binary"), "text/plain")).toBeNull();
    expect(sniffType(Buffer.from("<html>"), "text/html")).toBeNull();
  });
});

describe("relevantie-prefilter en publicatiepoort", () => {
  it("herkent doelgroeprelevante opdrachten via CPV of termen (NL/FR/EN)", () => {
    expect(isPotentiallyRelevant({ cpvCodes: ["45000000"], text: "Mise en place d'une plateforme de données" }).relevant).toBe(true);
    expect(isPotentiallyRelevant({ cpvCodes: ["45000000"], text: "Renovatie van een sporthal" }).relevant).toBe(false);
    expect(isPotentiallyRelevant({ cpvCodes: [], text: "Mobiliteitsplan" }).relevant).toBe(false); // geen 'bi' in 'mobiliteit'
  });
  it("alleen goedgekeurde, actuele beoordelingen zijn publiceerbaar", () => {
    const base = { status: "approved" as const, stale: false, procedureFingerprint: "fp", isCurrent: true, profileVersion: 1 };
    const ok = { procedureFingerprint: "fp", currentProfileVersion: 1, procedureIsDemo: false, organizationIsDemo: false };
    expect(checkPublishable({ assessment: base, ...ok }).ok).toBe(true);
    expect(checkPublishable({ assessment: { ...base, status: "to_review" }, ...ok }).ok).toBe(false);
    expect(checkPublishable({ assessment: base, ...ok, procedureFingerprint: "nieuw" }).ok).toBe(false);
    expect(checkPublishable({ assessment: { ...base, stale: true }, ...ok }).ok).toBe(false);
    expect(checkPublishable({ assessment: base, ...ok, procedureIsDemo: true }).ok).toBe(false);
  });
});
