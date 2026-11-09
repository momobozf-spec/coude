/**
 * Zimmo — technisch voorbereid, standaard uitgeschakeld.
 *
 * Bij het ontwerpen van fase 1 was `https://www.zimmo.be/robots.txt` niet op te
 * halen: de host weigert geautomatiseerde requests. Dat is op zichzelf een
 * antwoord — Zimmo zit achter bot-detectie — en het is precies de situatie
 * waarin we níet gaan zoeken naar een omweg.
 *
 * Wat deze klasse daarom doet:
 *
 *  - Ze bestaat, met dezelfde structuur als elke andere bron, zodat aanzetten
 *    later één regel in `SCRAPER_ENABLED_SOURCES` is en geen herbouw.
 *  - Ze gaat als eerste langs `RobotsPolicy`. Kan die robots.txt niet ophalen
 *    of staat het pad niet toe, dan stopt de bron met `SourceBlockedError` en
 *    gaat hij in cooldown.
 *  - Ze bevat geen enkele techniek om die blokkade te omzeilen: geen
 *    stealth-browser, geen proxy's, geen gespoofte fingerprints, geen
 *    CAPTCHA-verwerking.
 *
 * De normalisatie loopt via dezelfde JSON-LD-route als Immoweb. Die is voor
 * Zimmo NIET geverifieerd tegen een echte pagina — zodra geautomatiseerde
 * toegang is toegestaan, moet dat eerst gebeuren.
 */
import * as cheerio from "cheerio";
import { BaseSource } from "../base/BaseSource.js";
import { extractJsonLd, findByType, pickNumber, pickString } from "../base/jsonld.js";
import type { HttpClient } from "../base/HttpClient.js";
import type { RawListing, SourceKind, SourceSearchContext } from "../types.js";
import type { SearchCriteria } from "../../schemas/searchCriteria.js";
import { LogEvent } from "../../lib/events.js";
import { slugify } from "../immoweb/urls.js";

export const ZIMMO_SOURCE_NAME = "zimmo";
const ZIMMO_ORIGIN = "https://www.zimmo.be";

interface ZimmoPayload {
  nodes: ReturnType<typeof extractJsonLd>;
  url: string;
  externalId: string;
}

export class ZimmoSource extends BaseSource {
  readonly name = ZIMMO_SOURCE_NAME;
  readonly kind: SourceKind = "scrape";
  override readonly requiresBrowser = false;

  constructor(private readonly http: HttpClient) {
    super();
  }

  override supports(_criteria: SearchCriteria): boolean {
    return true;
  }

  protected async fetchRaw(criteria: SearchCriteria, context: SourceSearchContext): Promise<RawListing[]> {
    const transaction = criteria.transactionType === "rent" ? "te-huur" : "te-koop";
    const place = criteria.locations?.[0] ? slugify(criteria.locations[0]) : "";
    const searchUrl = place
      ? `${ZIMMO_ORIGIN}/nl/${place}/${transaction}/`
      : `${ZIMMO_ORIGIN}/nl/zoeken/${transaction}/`;

    // De HttpClient controleert robots.txt vóór de request en gooit
    // SourceBlockedError bij een 403 of een onbereikbare robots.txt. We vangen
    // dat hier niet af: de scheduler hoort te weten dat deze bron dicht is.
    context.logger.info({ event: LogEvent.SOURCE_STARTED, source: this.name }, "Zimmo: zoekpagina ophalen");

    const response = await this.http.fetchText(searchUrl, this.name, context.signal);
    if (response.status !== 200 || response.body === "") return [];

    const $ = cheerio.load(response.body);
    const detailUrls = new Map<string, string>();

    $("a[href]").each((_i, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      let url: URL;
      try {
        url = new URL(href, ZIMMO_ORIGIN);
      } catch {
        return;
      }
      const id = /\/([A-Z0-9]{5,})\/?$/i.exec(url.pathname)?.[1];
      if (!id || detailUrls.has(id)) return;
      url.search = "";
      url.hash = "";
      detailUrls.set(id, url.toString());
    });

    const raws: RawListing[] = [];
    for (const [externalId, url] of detailUrls) {
      if (context.signal.aborted || raws.length >= context.maxResults) break;
      const detail = await this.http.fetchText(url, this.name, context.signal);
      if (detail.status !== 200 || detail.body === "") continue;

      const nodes = extractJsonLd(detail.body);
      if (nodes.length === 0) continue;

      raws.push({
        source: this.name,
        externalId,
        url: detail.url,
        payload: { nodes, url: detail.url, externalId } satisfies ZimmoPayload,
        fetchedAt: new Date(),
      });
    }

    context.logger.info({ event: LogEvent.SOURCE_COMPLETED, source: this.name, count: raws.length }, "Zimmo: klaar");
    return raws;
  }

  protected normalizeOne(raw: RawListing): unknown {
    const payload = raw.payload as ZimmoPayload;
    const main = findByType(payload.nodes, "product", "residence", "apartment", "house", "offer") ?? payload.nodes[0];
    if (!main) throw new Error("Geen bruikbare JSON-LD op de pagina");

    const title = pickString(main, "name", "headline");
    if (!title) throw new Error("JSON-LD bevat geen titel");

    return {
      externalId: payload.externalId,
      source: this.name,
      url: payload.url,
      title,
      description: pickString(main, "description"),
      address: pickString(main, "address.streetAddress"),
      postalCode: /\b(\d{4})\b/.exec(pickString(main, "address.postalCode") ?? "")?.[1],
      city: pickString(main, "address.addressLocality"),
      price: pickNumber(main, "offers.price", "price"),
      bedrooms: pickNumber(main, "numberOfBedrooms", "numberOfRooms"),
      livingAreaM2: pickNumber(main, "floorSize.value", "floorSize"),
      imageUrl: pickString(main, "image.url", "image"),
      features: [],
      transactionType: /te-huur/i.test(payload.url) ? "rent" : "buy",
      discoveredAt: new Date(),
    };
  }
}
