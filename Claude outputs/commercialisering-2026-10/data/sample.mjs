// Read-only TED-steekproef (buiten de projectmap). Schrijft JSON naar stdout.
const BASE = "https://api.ted.europa.eu";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const now = new Date();
const from90 = new Date(now.getTime() - 90 * 86400000);
const log = (m) => process.stderr.write(m + "\n");

async function search(body, attempt = 0) {
  await sleep(1500);
  const res = await fetch(`${BASE}/v3/notices/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ scope: "ALL", checkQuerySyntax: false, onlyLatestVersions: false, ...body }),
    signal: AbortSignal.timeout(90000),
  });
  if (res.status === 429 && attempt < 6) {
    const wait = 5000 * 2 ** attempt;
    log(`429 → wacht ${wait / 1000}s`);
    await sleep(wait);
    return search(body, attempt + 1);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: json ? undefined : text.slice(0, 800) };
}

const mode = process.argv[2] ?? "probe";
const out = {};
if (mode === "probe") {
  // waarom gaf ITERATION 400?
  const q = `buyer-country=BEL AND publication-date>=${ymd(from90)} AND classification-cpv=72*`;
  out.iterSort = await search({ query: `${q} SORT BY publication-number ASC`, fields: ["publication-number"], limit: 20, paginationMode: "ITERATION" });
  out.iterNoSort = await search({ query: q, fields: ["publication-number"], limit: 20, paginationMode: "ITERATION" });
  for (const k of Object.keys(out)) out[k] = { status: out[k].status, err: out[k].status === 200 ? undefined : (out[k].json ?? out[k].text), total: out[k].json?.totalNoticeCount, n: out[k].json?.notices?.length, token: !!out[k].json?.iterationNextToken };
  // totalen
  const qs = {
    "BE alle publicaties 90d": `buyer-country=BEL AND publication-date>=${ymd(from90)}`,
    "BE CPV 72* (IT-diensten) 90d": `buyer-country=BEL AND publication-date>=${ymd(from90)} AND classification-cpv=72*`,
    "BE CPV 48* (software) 90d": `buyer-country=BEL AND publication-date>=${ymd(from90)} AND classification-cpv=48*`,
  };
  out.totals = {};
  for (const [k, q2] of Object.entries(qs)) {
    const r = await search({ query: q2, fields: ["publication-number"], limit: 1, page: 1, paginationMode: "PAGE_NUMBER" });
    out.totals[k] = r.status === 200 ? r.json.totalNoticeCount : { status: r.status, err: r.json ?? r.text };
  }
} else if (mode === "pull") {
  // haal alle BE-publicaties 90d op met CPV 72*/48* of data-trefwoord in tekst
  const SUBJECT = '(classification-cpv=72* OR classification-cpv=48* OR FT~("Power BI") OR FT~("Fabric") OR FT~("Databricks") OR FT~("datawarehouse") OR FT~("data warehouse") OR FT~("entrepôt de données") OR FT~("business intelligence") OR FT~("data governance") OR FT~("datagovernance") OR FT~("dataplatform") OR FT~("data platform") OR FT~("plateforme de données") OR FT~("analytics") OR FT~("rapportering") OR FT~("reporting"))';
  const q = `buyer-country=BEL AND publication-date>=${ymd(from90)} AND ${SUBJECT}`;
  const fields = ["publication-number", "notice-type", "form-type", "publication-date", "notice-title", "buyer-name", "classification-cpv", "title-lot", "description-lot", "framework-agreement-lot", "estimated-value-lot", "deadline-receipt-tender-date-lot", "procedure-identifier", "official-language"];
  const notices = [];
  let page = 1, total = null;
  while (true) {
    const r = await search({ query: q, fields, limit: 100, page, paginationMode: "PAGE_NUMBER" });
    if (r.status !== 200) { out.error = { page, status: r.status, err: r.json ?? r.text }; break; }
    total = r.json.totalNoticeCount;
    notices.push(...r.json.notices);
    log(`pagina ${page}: ${notices.length}/${total}`);
    if (notices.length >= total || r.json.notices.length === 0 || page >= 30) break;
    page++;
  }
  out.query = q; out.total = total; out.fetched = notices.length; out.notices = notices;
}
process.stdout.write(JSON.stringify(out, null, 1));
