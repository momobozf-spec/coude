/**
 * Immoweb.
 *
 * Werkwijze, en waarom:
 *
 *  1. Pad-gebaseerde zoek-URL's (zie urls.ts). Filteren via query-parameters is
 *     door robots.txt verboden, dus filteren we zelf.
 *  2. Van de zoekpagina halen we alleen de links naar detailpagina's. Die vorm
 *     (`/nl/zoekertje/<slug>/<id>`) staat in hun eigen sitemap en is dus
 *     publiek bedoeld.
 *  3. Van elke detailpagina lezen we de JSON-LD. Dat is gestructureerde data
 *     die de site bewust publiceert; we raden geen CSS-klassen.
 *  4. Elke request gaat langs `RobotsPolicy` en de snelheidsbeperking.
 *
 * En wat er níet gebeurt: geen CAPTCHA-verwerking, geen browser-fingerprinting,
 * geen proxy's, geen headless browser die zich voordoet als een echte gebruiker.
 * Krijgen we een 403 of een challenge, dan gooit de HttpClient
 * `SourceBlockedError`, gaat de bron in cooldown en stopt hij. Dat is een
 * antwoord, geen obstakel.
 *
 * ⚠️ Deze bron staat standaard UIT. robots.txt is niet hetzelfde als de
 * gebruiksvoorwaarden; die afweging hoort bij de beheerder van de installatie.
 * Aanzetten gebeurt bewust via SCRAPER_ENABLED_SOURCES.
 */
import * as cheerio from "cheerio";
import { BaseSource } from "../base/BaseSource.js";
import { extractJsonLd } from "../base/jsonld.js";
import type { HttpClient } from "../base/HttpClient.js";
import type { RawListing, SourceKind, SourceSearchContext } from "../types.js";
import type { SearchCriteria } from "../../schemas/searchCriteria.js";
import { LogEvent } from "../../lib/events.js";
import { SourceBlockedError } from "../../lib/errors.js";
import { normalizeImmoweb, type ImmowebPayload } from "./normalize.js";
import { absoluteUrl, buildSearchUrls, externalIdFromUrl, isDetailUrl, withPage } from "./urls.js";

export const IMMOWEB_SOURCE_NAME = "immoweb";

/** Hoeveel zoekpagina's per URL we maximaal doorlopen. */
const MAX_PAGES_PER_URL = 3;

export class ImmowebSource extends BaseSource {
  readonly name = IMMOWEB_SOURCE_NAME;
  readonly kind: SourceKind = "scrape";
  override readonly requiresBrowser = false;

  constructor(private readonly http: HttpClient) {
    super();
  }

  /** Immoweb dekt heel België; er is geen criterium dat de bron uitsluit. */
  override supports(_criteria: SearchCriteria): boolean {
    return true;
  }

  protected async fetchRaw(criteria: SearchCriteria, context: SourceSearchContext): Promise<RawListing[]> {
    const searchUrls = buildSearchUrls(criteria);
    const detailUrls = new Map<string, string>();

    context.logger.info(
      { event: LogEvent.SOURCE_STARTED, source: this.name, searchUrls: searchUrls.length },
      "Immoweb: zoekpagina's ophalen",
    );

    outer: for (const searchUrl of searchUrls) {
      for (let page = 1; page <= MAX_PAGES_PER_URL; page++) {
        if (context.signal.aborted) break outer;
        if (detailUrls.size >= context.maxResults) break outer;

        const pageUrl = withPage(searchUrl, page);
        const response = await this.http.fetchText(pageUrl, this.name, context.signal);
        if (response.status !== 200 || response.body === "") break;

        const before = detailUrls.size;
        for (const [id, url] of this.extractDetailLinks(response.body)) {
          if (!detailUrls.has(id)) detailUrls.set(id, url);
          if (detailUrls.size >= context.maxResults) break;
        }

        // Geen nieuwe advertenties op deze pagina: verder bladeren is zinloos
        // en kost de site alleen maar requests.
        if (detailUrls.size === before) break;
      }
    }

    context.logger.info(
      { event: LogEvent.PROPERTY_FOUND, source: this.name, count: detailUrls.size },
      "Immoweb: detailpagina's gevonden",
    );

    const raws: RawListing[] = [];
    for (const [externalId, url] of detailUrls) {
      if (context.signal.aborted) break;
      if (raws.length >= context.maxResults) break;

      try {
        const response = await this.http.fetchText(url, this.name, context.signal);
        if (response.status !== 200 || response.body === "") continue;

        const nodes = extractJsonLd(response.body);
        if (nodes.length === 0) {
          context.logger.warn(
            { event: LogEvent.PROPERTY_NORMALIZE_FAILED, source: this.name, externalId, reason: "geen JSON-LD" },
            "Immoweb: detailpagina zonder gestructureerde data",
          );
          continue;
        }

        const payload: ImmowebPayload = { nodes, url: response.url, externalId };
        raws.push({ source: this.name, externalId, url: response.url, payload, fetchedAt: new Date() });
      } catch (e) {
        // Een blokkade geldt voor de hele bron, niet voor één advertentie.
        if (e instanceof SourceBlockedError) throw e;
        context.logger.warn(
          { event: LogEvent.SOURCE_FAILED, source: this.name, externalId, reason: (e as Error).message },
          "Immoweb: detailpagina overgeslagen",
        );
      }
    }

    context.logger.info(
      { event: LogEvent.SOURCE_COMPLETED, source: this.name, count: raws.length },
      "Immoweb: klaar",
    );
    return raws;
  }

  protected normalizeOne(raw: RawListing): unknown {
    return normalizeImmoweb(raw.payload as ImmowebPayload);
  }

  /** Links naar detailpagina's, ontdubbeld op advertentie-id. */
  private extractDetailLinks(html: string): Map<string, string> {
    const $ = cheerio.load(html);
    const found = new Map<string, string>();

    $("a[href]").each((_i, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      const url = absoluteUrl(href);
      if (!url || !isDetailUrl(url)) return;
      const id = externalIdFromUrl(url);
      if (!id || found.has(id)) return;
      // Query en fragment weg: dezelfde advertentie met een tracking-parameter
      // is dezelfde advertentie.
      const parsed = new URL(url);
      parsed.search = "";
      parsed.hash = "";
      found.set(id, parsed.toString());
    });

    return found;
  }
}
