/**
 * Lokale heuristische analyse van een URL of berichttekst.
 *
 * - Volledig op het toestel: er worden geen netwerkverzoeken gedaan en links worden
 *   nooit geopend of bezocht.
 * - Het resultaat is een indicatie op basis van herkenbare signalen, geen garantie.
 *
 * Dit bestand gebruikt bewust geen React Native-imports, zodat het ook in Node getest
 * kan worden (zie scripts/test-heuristics.ts).
 */

export type SignalSeverity = 'low' | 'medium' | 'high';

export interface Signal {
  id: string;
  label: string;
  explanation: string;
  severity: SignalSeverity;
  /** Het stukje tekst of de link waarop het signaal sloeg. */
  match?: string;
}

export type Verdict = 'empty' | 'no_signals' | 'caution' | 'suspicious';

export interface AnalysisResult {
  verdict: Verdict;
  points: number;
  signals: Signal[];
  urls: string[];
}

const SEVERITY_POINTS: Record<SignalSeverity, number> = { low: 1, medium: 2, high: 3 };

const SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'is.gd',
  'ow.ly',
  'cutt.ly',
  'rb.gy',
  't.ly',
  'shorturl.at',
  'tiny.cc',
  's.id',
  'buff.ly',
  'rebrand.ly',
  'bl.ink',
  'lnkd.in',
  'shorturl.gg',
];

/** TLD's die vaak in phishingcampagnes opduiken. Een signaal, geen bewijs. */
const RISKY_TLDS = ['zip', 'mov', 'top', 'xyz', 'click', 'icu', 'monster', 'rest', 'cfd', 'sbs', 'cyou', 'buzz', 'link', 'gq', 'tk', 'ml', 'cf', 'ga'];

/**
 * Merken die in BE/NL vaak worden nagebootst, met hun officiële domeinen.
 * `token` moet als los woord of domeindeel in de host voorkomen.
 */
const BRANDS: { token: string; name: string; domains: string[] }[] = [
  { token: 'bpost', name: 'bpost', domains: ['bpost.be', 'bpost.com'] },
  { token: 'postnl', name: 'PostNL', domains: ['postnl.nl', 'postnl.be', 'postnl.com'] },
  { token: 'dhl', name: 'DHL', domains: ['dhl.com', 'dhl.be', 'dhl.nl', 'dhlparcel.nl', 'dhlparcel.be'] },
  { token: 'kbc', name: 'KBC', domains: ['kbc.be', 'kbc.com', 'kbcbrussels.be'] },
  { token: 'belfius', name: 'Belfius', domains: ['belfius.be', 'belfius.com'] },
  { token: 'ing', name: 'ING', domains: ['ing.be', 'ing.nl', 'ing.com'] },
  { token: 'bnpparibas', name: 'BNP Paribas Fortis', domains: ['bnpparibasfortis.be', 'bnpparibas.com', 'bnpparibas.be'] },
  { token: 'argenta', name: 'Argenta', domains: ['argenta.be', 'argenta.nl'] },
  { token: 'rabobank', name: 'Rabobank', domains: ['rabobank.nl', 'rabobank.com', 'rabobank.be'] },
  { token: 'abnamro', name: 'ABN AMRO', domains: ['abnamro.nl', 'abnamro.com'] },
  { token: 'bunq', name: 'bunq', domains: ['bunq.com'] },
  { token: 'itsme', name: 'itsme', domains: ['itsme-id.com', 'itsme.be'] },
  { token: 'digid', name: 'DigiD', domains: ['digid.nl'] },
  { token: 'belastingdienst', name: 'Belastingdienst', domains: ['belastingdienst.nl'] },
  { token: 'myminfin', name: 'MyMinfin', domains: ['myminfin.be', 'belgium.be'] },
  { token: 'paypal', name: 'PayPal', domains: ['paypal.com', 'paypal.me'] },
  { token: 'netflix', name: 'Netflix', domains: ['netflix.com'] },
  { token: 'apple', name: 'Apple', domains: ['apple.com', 'icloud.com'] },
  { token: 'microsoft', name: 'Microsoft', domains: ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com'] },
];

/**
 * Korte of algemene tokens die ook in gewone woorden voorkomen (bv. "shopping", "pineapple").
 * Die tellen alleen als los domeindeel, niet als deel van een woord.
 */
const STRICT_TOKENS = new Set(['ing', 'kbc', 'dhl', 'bunq', 'apple']);

interface Phrase {
  id: string;
  label: string;
  explanation: string;
  severity: SignalSeverity;
  patterns: RegExp[];
}

const PHRASES: Phrase[] = [
  {
    id: 'urgency',
    label: 'Urgent of dreigend taalgebruik',
    explanation: 'Oplichters zetten je onder tijdsdruk zodat je niet rustig nadenkt.',
    severity: 'medium',
    patterns: [
      /\bdringend\b/i,
      /\bonmiddellijk\b/i,
      /\bdirect actie\b/i,
      /\bbinnen (de )?(24|48|12) ?(uur|u)\b/i,
      /\blaatste (kans|herinnering|waarschuwing)\b/i,
      /\bvandaag nog\b/i,
      /\b(wordt|is|word) (geblokkeerd|opgeschort|afgesloten|verwijderd)\b/i,
      /\bverloopt (vandaag|binnenkort)\b/i,
      /\bimm[ée]diatement\b/i,
      /\burgent\b/i,
      /\b(bloqu[ée]|suspendu)\b/i,
    ],
  },
  {
    id: 'credentials',
    label: 'Vraagt om inloggegevens of codes',
    explanation: 'Een bank, overheid of webshop vraagt nooit je wachtwoord, pincode of itsme-code via sms, mail of chat.',
    severity: 'high',
    patterns: [
      /\bwachtwoord\b/i,
      /\bpin ?code\b/i,
      /\binloggegevens\b/i,
      /\b(bevestig|verifieer|controleer|update) (uw|je|jouw) (gegevens|account|identiteit|rekening)\b/i,
      /\bkaartnummer\b/i,
      /\bcvc\b/i,
      /\bitsme[- ]?code\b/i,
      /\b(digipass|kaartlezer|responscode|response code)\b/i,
      /\bmot de passe\b/i,
      /\bcode pin\b/i,
      /\bpassword\b/i,
    ],
  },
  {
    id: 'payment',
    label: 'Onverwachte betaling of pakketkosten',
    explanation: 'Valse berichten over verzendkosten, douanekosten of openstaande bedragen zijn een veelvoorkomende truc.',
    severity: 'medium',
    patterns: [
      /\b(verzend|douane|invoer|bezorg)kosten\b/i,
      /\bopenstaand(e)? (bedrag|factuur|saldo)\b/i,
      /\bpakket\b.*\b(betaal|betaling|kosten|bevestig)\b/i,
      /\b(boete|achterstallig|incasso)\b/i,
      /\b(terugbetaling|teruggave|restitutie|remboursement)\b/i,
    ],
  },
  {
    id: 'family_impersonation',
    label: 'Mogelijke “Hoi mam/pap”-fraude',
    explanation: 'Iemand doet zich voor als familielid met een nieuw nummer en vraagt al snel om geld.',
    severity: 'high',
    patterns: [
      /\b(hoi|hey|hallo|dag) (mam|mama|pap|papa|ma|pa)\b/i,
      /\bnieuw (tele)?(foon)?nummer\b/i,
      /\bmijn (telefoon|gsm) is (kapot|stuk|gevallen)\b/i,
    ],
  },
  {
    id: 'prize',
    label: 'Prijs, cadeau of “gratis” aanbod',
    explanation: 'Onverwachte winst of cadeaus zijn een klassiek lokmiddel.',
    severity: 'low',
    patterns: [/\b(gewonnen|winnaar|prijs ?winnaar)\b/i, /\bcadeau ?(kaart|bon)\b/i, /\bgratis\b/i, /\bgagn[ée]\b/i],
  },
];

const URL_REGEX =
  /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,24}(?::\d{2,5})?(?:\/[^\s<>"']*)?)|\b(https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?(?:\/[^\s<>"']*)?)/gi;

/** Haalt link-achtige stukken uit een tekst. Bezoekt niets. */
export function extractUrls(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(URL_REGEX)) {
    let candidate = (m[1] ?? m[2] ?? '').replace(/[),.;:!?]+$/, '');
    if (!candidate) continue;
    // Sla e-mailadressen over (die matchen anders op het domeindeel).
    const idx = m.index ?? 0;
    if (idx > 0 && text[idx - 1] === '@') continue;
    // Sla losse "woorden.woorden" zonder bekende structuur over als ze geen TLD-achtig einde hebben.
    if (!/^https?:\/\//i.test(candidate) && !/\.[a-z]{2,24}(\/|:|$)/i.test(candidate)) continue;
    found.add(candidate);
  }
  return [...found];
}

export function parseHost(raw: string): { host: string; scheme: string; hasUserInfo: boolean } | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(withScheme);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : 'http';
  const rest = withScheme.slice((schemeMatch?.[0].length ?? 0));
  const authority = rest.split(/[/?#]/)[0] ?? '';
  const hasUserInfo = authority.includes('@');
  const hostPort = hasUserInfo ? authority.slice(authority.lastIndexOf('@') + 1) : authority;
  const host = hostPort.replace(/:\d+$/, '').toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.')) return null;
  return { host, scheme, hasUserInfo };
}

function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Analyseert één link. Bezoekt de link niet. */
export function analyzeUrl(raw: string): Signal[] {
  const parsed = parseHost(raw);
  if (!parsed) return [];
  const { host, scheme, hasUserInfo } = parsed;
  const signals: Signal[] = [];
  const labels = host.split('.');
  const tld = labels[labels.length - 1] ?? '';

  if (SHORTENERS.some((s) => hostMatchesDomain(host, s))) {
    signals.push({
      id: 'shortener',
      label: 'Verkorte link',
      explanation: 'Een verkorte link verbergt waar je echt terechtkomt.',
      severity: 'medium',
      match: host,
    });
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    signals.push({
      id: 'ip_host',
      label: 'Link naar een IP-adres',
      explanation: 'Echte organisaties gebruiken een domeinnaam, geen reeks cijfers.',
      severity: 'high',
      match: host,
    });
  }

  if (labels.some((l) => l.startsWith('xn--'))) {
    signals.push({
      id: 'punycode',
      label: 'Domein met speciale tekens (punycode)',
      explanation: 'Zo kan een domein lijken op een bekend domein terwijl het een ander is.',
      severity: 'high',
      match: host,
    });
  }

  if (hasUserInfo) {
    signals.push({
      id: 'userinfo',
      label: 'Misleidende “@” in de link',
      explanation: 'Alles vóór de @ wordt genegeerd; de echte bestemming staat erachter.',
      severity: 'high',
      match: host,
    });
  }

  if (RISKY_TLDS.includes(tld)) {
    signals.push({
      id: 'risky_tld',
      label: `Ongebruikelijke domeinextensie (.${tld})`,
      explanation: 'Deze extensie wordt relatief vaak misbruikt. Dat zegt niet alles, maar is een signaal.',
      severity: 'low',
      match: host,
    });
  }

  // Merknaam in de host, maar niet op een officieel domein van dat merk.
  for (const brand of BRANDS) {
    const tokenRegex = new RegExp(`(^|[.-])${brand.token}([.-]|$)`, 'i');
    const containsToken = tokenRegex.test(host) || (!STRICT_TOKENS.has(brand.token) && host.includes(brand.token));
    if (!containsToken) continue;
    const official = brand.domains.some((d) => hostMatchesDomain(host, d));
    if (!official) {
      signals.push({
        id: 'brand_mismatch',
        label: `Lijkt op ${brand.name}, maar is geen officieel domein`,
        explanation: `De link noemt ${brand.name}, maar verwijst niet naar een gekend domein van ${brand.name}.`,
        severity: 'high',
        match: host,
      });
    }
    break;
  }

  if (labels.length >= 5) {
    signals.push({
      id: 'many_subdomains',
      label: 'Erg lange domeinnaam met veel onderdelen',
      explanation: 'Lange domeinen worden gebruikt om een bekende naam vooraan te verstoppen.',
      severity: 'low',
      match: host,
    });
  }

  const registrable = labels.slice(-2).join('.');
  if ((registrable.match(/-/g) ?? []).length >= 2) {
    signals.push({
      id: 'hyphens',
      label: 'Domein met veel streepjes',
      explanation: 'Namen als “mijn-bank-veilig” worden vaak voor nepsites gebruikt.',
      severity: 'low',
      match: host,
    });
  }

  if (scheme === 'http' && /^http:\/\//i.test(raw)) {
    signals.push({
      id: 'no_https',
      label: 'Geen beveiligde verbinding (http)',
      explanation: 'De link gebruikt geen https. Vul daar zeker nooit gegevens in.',
      severity: 'low',
      match: host,
    });
  }

  return signals;
}

export function analyzeText(input: string): AnalysisResult {
  const text = input.trim();
  if (!text) return { verdict: 'empty', points: 0, signals: [], urls: [] };

  const signals: Signal[] = [];
  const urls = extractUrls(text);

  for (const url of urls) {
    for (const s of analyzeUrl(url)) {
      // Dubbele signalen (zelfde id + host) maar één keer tonen.
      if (!signals.some((x) => x.id === s.id && x.match === s.match)) signals.push(s);
    }
  }

  for (const phrase of PHRASES) {
    for (const pattern of phrase.patterns) {
      const m = pattern.exec(text);
      if (m) {
        signals.push({
          id: phrase.id,
          label: phrase.label,
          explanation: phrase.explanation,
          severity: phrase.severity,
          match: m[0],
        });
        break;
      }
    }
  }

  const hasLink = urls.length > 0;
  const hasPressure = signals.some((s) => ['urgency', 'credentials', 'payment', 'family_impersonation'].includes(s.id));
  if (hasLink && hasPressure) {
    signals.push({
      id: 'link_plus_pressure',
      label: 'Link gecombineerd met druk of een verzoek',
      explanation: 'Een link plus tijdsdruk of een vraag om gegevens of geld is het typische patroon van phishing.',
      severity: 'medium',
    });
  }

  const points = signals.reduce((sum, s) => sum + SEVERITY_POINTS[s.severity], 0);
  const hasHigh = signals.some((s) => s.severity === 'high');
  let verdict: Verdict = 'no_signals';
  if (points >= 4 || (hasHigh && points >= 3)) verdict = 'suspicious';
  else if (points >= 1) verdict = 'caution';

  return { verdict, points, signals, urls };
}

/** Lokale e-mailvalidatie (syntactisch). Verstuurt niets. */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 6 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,24}$/i.test(v);
}
