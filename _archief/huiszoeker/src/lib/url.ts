/**
 * URL-normalisatie en -validatie.
 *
 * `normalizeUrl` is de tweede ontdubbelingssleutel (na `source + externalId`).
 * De regels zijn opzettelijk conservatief: we strippen alleen wat aantoonbaar
 * geen ander pand aanwijst — tracking-parameters, fragment, trailing slash,
 * hoofdletters in host. Een query-parameter die we niet kennen blijft staan,
 * want die kán betekenisdragend zijn.
 *
 * `assertSafeOutboundUrl` bewaakt de andere kant: elke URL die de applicatie
 * zelf ophaalt (webhooks, scrapers) moet publiek en http(s) zijn. Zonder die
 * check is een door de gebruiker ingestelde webhook-URL een SSRF-gat naar
 * `http://169.254.169.254/` of `http://localhost:5432`.
 */
import { ValidationError } from "./errors.js";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
  "source",
]);

export function normalizeUrl(input: string): string {
  const url = new URL(input);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  // Stabiele volgorde: ?b=2&a=1 en ?a=1&b=2 zijn dezelfde pagina.
  url.searchParams.sort();

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/** Hostnames die nooit vanuit de applicatie benaderd mogen worden. */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 loopback / link-local / unique-local.
  if (h === "::1" || h.startsWith("[::1") || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // cloud metadata
  return false;
}

/**
 * Let op: dit dekt de directe URL, niet een DNS-naam die naar een privé-IP
 * wijst. Volledige bescherming vraagt een resolve-check op connect-niveau; dat
 * hoort bij de HTTP-client (fase 3), niet hier.
 */
export function assertSafeOutboundUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError("Ongeldige URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("Alleen http- en https-URL's zijn toegestaan");
  }
  if (isPrivateHost(url.hostname)) {
    throw new ValidationError("URL's naar interne of privé-adressen zijn niet toegestaan");
  }
  return url;
}
