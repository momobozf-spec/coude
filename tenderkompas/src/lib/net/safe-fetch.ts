import https from "node:https";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";

/**
 * SSRF-veilig ophalen van bronbestanden:
 * - enkel https, poort 443, geen inloggegevens in de URL;
 * - DNS-resolutie wordt gecontroleerd op het moment van verbinden (geen DNS-rebinding);
 * - private, loopback, link-local, multicast en gereserveerde adressen geweigerd;
 * - redirects handmatig, maximaal 3, elke stap opnieuw gevalideerd;
 * - limieten op grootte, duur en inhoudstype.
 */
export class SafeFetchError extends Error {}

export function isPublicAddress(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  let addr = ipaddr.parse(ip);
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) addr = (addr as ipaddr.IPv6).toIPv4Address();
  return addr.range() === "unicast";
}

export function validateFetchUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SafeFetchError("Ongeldige URL.");
  }
  if (u.protocol !== "https:") throw new SafeFetchError("Alleen https-URL's zijn toegestaan.");
  if (u.username || u.password) throw new SafeFetchError("URL's met inloggegevens zijn niet toegestaan.");
  if (u.port && u.port !== "443") throw new SafeFetchError("Alleen standaardpoort 443 is toegestaan.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && !isPublicAddress(host)) throw new SafeFetchError("Adres in een privé of gereserveerd netwerk geweigerd.");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new SafeFetchError("Interne hostnaam geweigerd.");
  return u;
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family as number | undefined }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad || !list.length) return callback(new SafeFetchError("Doeladres ligt in een privé of gereserveerd netwerk."), "", 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export type SafeFetchResult = { finalUrl: string; contentType: string; body: Buffer };

export async function safeFetch(
  rawUrl: string,
  opts: { maxBytes?: number; timeoutMs?: number; allowedTypes?: string[]; maxRedirects?: number } = {},
): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? Number(process.env.FETCH_MAX_BYTES ?? 20 * 1024 * 1024);
  const timeoutMs = opts.timeoutMs ?? Number(process.env.FETCH_TIMEOUT_MS ?? 20_000);
  const allowed = opts.allowedTypes ?? ["application/pdf", "text/plain"];
  let url = validateFetchUrl(rawUrl);
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    const res = await requestOnce(url, timeoutMs, maxBytes);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new SafeFetchError(`Redirect (${res.status}) zonder Location.`);
      url = validateFetchUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status !== 200) throw new SafeFetchError(`Bron antwoordde met status ${res.status}.`);
    const ct = (res.contentType ?? "").split(";")[0].trim().toLowerCase();
    if (!allowed.includes(ct)) throw new SafeFetchError(`Inhoudstype "${ct || "onbekend"}" niet toegestaan.`);
    return { finalUrl: url.toString(), contentType: ct, body: res.body! };
  }
  throw new SafeFetchError("Te veel redirects.");
}

function requestOnce(url: URL, timeoutMs: number, maxBytes: number) {
  return new Promise<{ status: number; location?: string; contentType?: string; body?: Buffer }>((resolve, reject) => {
    const req = https.request(
      url,
      { method: "GET", lookup: guardedLookup, timeout: timeoutMs, headers: { "User-Agent": "TenderKompasIT/0.1 (+documentophaling)", Accept: "application/pdf,text/plain" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return reject(new SafeFetchError(`Bestand te groot (${declared} bytes).`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new SafeFetchError("Bestand overschrijdt de maximale grootte."));
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ status, contentType: res.headers["content-type"], body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new SafeFetchError("Time-out bij ophalen.")));
    req.on("error", reject);
    req.end();
  });
}
