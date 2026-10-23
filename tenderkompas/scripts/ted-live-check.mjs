#!/usr/bin/env node
/**
 * Live verificatie van de TED Search API — zelfstandig, zonder database of npm-dependencies (Node ≥ 20).
 *
 *   node scripts/ted-live-check.mjs > ted-live-report.json
 *
 * Nodig netwerk: uitgaand HTTPS naar api.ted.europa.eu (443). Optioneel voor links: ted.europa.eu.
 * Controleert met ECHTE antwoorden:
 *  1. elk veld dat de importer opvraagt (afzonderlijk, limit 1) → geaccepteerd of geweigerd + type van de waarde;
 *  2. paginering in ITERATION-modus (3 pagina's, token, overlap, timedOut);
 *  3. percelen: lengte van per-perceelarrays t.o.v. identifier-lot bij Belgische meerpercelen-aankondigingen;
 *  4. wijzigingen (change-reason-code / change-notice-version-identifier) en intrekkingen (cancel);
 *  5. formaat van deadlinedatum en -tijd (offset aanwezig?);
 *  6. omvang van de 90-dagenzoekopdracht (totalNoticeCount), zonder de import zelf.
 * Schrijft niets weg; enkel een JSON-rapport naar stdout. Respecteert fair use (pauze tussen verzoeken).
 */
const BASE = process.env.TED_API_BASE ?? "https://api.ted.europa.eu";
const FIELDS = [
  "publication-number", "notice-identifier", "notice-version", "procedure-identifier", "notice-type", "form-type",
  "publication-date", "notice-title", "official-language", "buyer-name", "buyer-country", "classification-cpv",
  "procedure-type", "description-proc", "title-lot", "identifier-lot", "description-lot",
  "place-of-performance-country-proc", "place-of-performance-country-lot", "place-of-performance-subdiv-proc", "place-of-performance-subdiv-lot",
  "estimated-value-proc", "estimated-value-cur-proc", "estimated-value-lot", "estimated-value-cur-lot", "framework-agreement-lot",
  "deadline-receipt-tender-date-lot", "deadline-receipt-tender-time-lot", "deadline-receipt-request-date-lot", "deadline-receipt-request-time-lot",
  "change-reason-code", "change-description", "change-notice-version-identifier", "competition-termination-proc", "document-url-lot",
  "framework-maximum-value-lot", "framework-maximum-value-cur-lot", "deadline-receipt-answers-date-lot", "deadline-receipt-answers-time-lot",
  "duration-period-value-lot", "duration-period-unit-lot",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const now = new Date();
const from90 = new Date(now.getTime() - 90 * 86400000);
const SUBJECT =
  '(classification-cpv=72* OR classification-cpv=48* OR FT~("Power BI") OR FT~("Microsoft Fabric") OR FT~("Databricks") OR FT~("Azure") OR FT~("datawarehouse") OR FT~("data warehouse") OR FT~("entrepôt de données") OR FT~("dataplatform") OR FT~("plateforme de données") OR FT~("data platform") OR FT~("business intelligence") OR FT~("datagovernance") OR FT~("gouvernance des données") OR FT~("data governance"))';
const BE90 = `buyer-country=BEL AND publication-date>=${ymd(from90)} AND publication-date<=${ymd(now)} AND ${SUBJECT}`;

async function search(body) {
  await sleep(400);
  const res = await fetch(`${BASE}/v3/notices/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ scope: "ALL", checkQuerySyntax: false, onlyLatestVersions: false, ...body }),
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: json ? undefined : text.slice(0, 500) };
}
const typeOf = (v) => (v === undefined ? "afwezig" : Array.isArray(v) ? `array<${typeof v[0]}>` : v && typeof v === "object" ? `object{${Object.keys(v).slice(0, 3).join(",")}}` : typeof v);

const report = { ranAt: now.toISOString(), base: BASE, fields: {}, pagination: null, lots: [], changes: null, cancellations: null, deadlines: [], sample90: null, errors: [] };
try {
  // 1. Velden
  for (const f of FIELDS) {
    const r = await search({ query: `buyer-country=BEL AND publication-date>=${ymd(from90)}`, fields: ["publication-number", f], limit: 5, page: 1, paginationMode: "PAGE_NUMBER" });
    const vals = (r.json?.notices ?? []).map((n) => n[f]).filter((v) => v !== undefined);
    report.fields[f] = r.status === 200 ? { accepted: true, seenInResults: vals.length, valueType: typeOf(vals[0]), example: vals[0] ?? null } : { accepted: false, status: r.status, error: r.json ?? r.text };
  }
  const okFields = Object.entries(report.fields).filter(([, v]) => v.accepted).map(([k]) => k);

  // 2. Paginering (ITERATION)
  const pages = [];
  let token;
  for (let i = 0; i < 3; i++) {
    const r = await search({ query: `${BE90} SORT BY publication-number ASC`, fields: ["publication-number"], limit: 20, paginationMode: "ITERATION", ...(token ? { iterationNextToken: token } : {}) });
    pages.push({ status: r.status, count: r.json?.notices?.length ?? null, total: r.json?.totalNoticeCount ?? null, hasToken: !!r.json?.iterationNextToken, timedOut: r.json?.timedOut ?? null, first: r.json?.notices?.[0]?.["publication-number"] ?? null });
    token = r.json?.iterationNextToken;
    if (!token) break;
  }
  const ids = new Set();
  report.pagination = { pages, distinctFirstIds: pages.map((p) => p.first).filter((x) => { const d = !ids.has(x); ids.add(x); return d; }).length };

  // 3 + 5. Percelen en deadlines
  const lotFields = okFields.filter((f) => f.endsWith("-lot") || f === "publication-number" || f === "notice-type");
  const lr = await search({ query: `${BE90} SORT BY publication-number DESC`, fields: lotFields, limit: 50, page: 1, paginationMode: "PAGE_NUMBER" });
  for (const n of lr.json?.notices ?? []) {
    const lots = [].concat(n["identifier-lot"] ?? []);
    if (lots.length < 2) continue;
    const lens = {};
    for (const f of lotFields) if (f !== "identifier-lot" && n[f] !== undefined) lens[f] = Array.isArray(n[f]) ? n[f].length : typeOf(n[f]);
    report.lots.push({ publicationNumber: n["publication-number"], lotCount: lots.length, arrayLengths: lens });
    if (report.lots.length >= 10) break;
  }
  for (const n of (lr.json?.notices ?? []).slice(0, 15)) {
    report.deadlines.push({ pub: n["publication-number"], date: n["deadline-receipt-tender-date-lot"] ?? null, time: n["deadline-receipt-tender-time-lot"] ?? null, requestDate: n["deadline-receipt-request-date-lot"] ?? null });
  }

  // 4. Wijzigingen en intrekkingen
  const ch = await search({ query: `buyer-country=BEL AND publication-date>=${ymd(from90)} AND change-reason-code=*`, fields: ["publication-number", "notice-type", "change-reason-code", "change-notice-version-identifier", "procedure-identifier"].filter((f) => okFields.includes(f) || f === "publication-number"), limit: 20, page: 1, paginationMode: "PAGE_NUMBER" });
  report.changes = { status: ch.status, total: ch.json?.totalNoticeCount ?? null, examples: (ch.json?.notices ?? []).slice(0, 10), error: ch.status === 200 ? undefined : (ch.json ?? ch.text) };
  const ca = await search({ query: `publication-date>=${ymd(from90)} AND change-reason-code=cancel`, fields: ["publication-number", "notice-type", "change-reason-code", "buyer-country"], limit: 10, page: 1, paginationMode: "PAGE_NUMBER" });
  report.cancellations = { status: ca.status, total: ca.json?.totalNoticeCount ?? null, examples: (ca.json?.notices ?? []).slice(0, 5), error: ca.status === 200 ? undefined : (ca.json ?? ca.text) };

  // 6. Omvang 90 dagen
  const s = await search({ query: BE90, fields: ["publication-number"], limit: 1, page: 1, paginationMode: "PAGE_NUMBER" });
  report.sample90 = { query: BE90, status: s.status, totalNoticeCount: s.json?.totalNoticeCount ?? null, note: "Aantal aankondigingen (incl. wijzigingen/gunningen), nog geen unieke procedures. Voer `npm run ted:sample` uit voor de ontdubbelde steekproef." };
} catch (e) {
  report.errors.push(String(e?.message ?? e));
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
const accepted = Object.values(report.fields).filter((v) => v.accepted).length;
process.stderr.write(`Velden geaccepteerd: ${accepted}/${FIELDS.length}. Rapport op stdout.\n`);
