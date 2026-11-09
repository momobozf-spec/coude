/**
 * Gedeeld skelet voor bronnen.
 *
 * `search()` is hier definitief geïmplementeerd; een concrete bron vult alleen
 * `fetchRaw` en `normalizeOne` in. Dat dwingt de scheiding tussen ophalen en
 * normaliseren af, en levert één gedrag op waar iedereen van profiteert:
 *
 *  - Eén advertentie die niet normaliseert laat de hele run niet klappen. Hij
 *    wordt gelogd als PROPERTY_NORMALIZE_FAILED en overgeslagen. Bij een
 *    sitewijziging krijg je zo negen bruikbare panden in plaats van nul.
 *  - Elke `PropertyListing` is gevalideerd voor hij de bron verlaat, dus geen
 *    enkele service downstream hoeft tegen half gevulde velden te verdedigen.
 */
import { propertyListingSchema, type PropertyListing } from "../../schemas/property.js";
import type { SearchCriteria } from "../../schemas/searchCriteria.js";
import { LogEvent } from "../../lib/events.js";
import type { PropertySource, RawListing, SourceKind, SourceSearchContext } from "../types.js";

export abstract class BaseSource implements PropertySource {
  abstract readonly name: string;
  abstract readonly kind: SourceKind;
  readonly requiresBrowser: boolean = false;

  supports(_criteria: SearchCriteria): boolean {
    return true;
  }

  /** Ophalen. Mag netwerk raken, mag gooien. */
  protected abstract fetchRaw(criteria: SearchCriteria, context: SourceSearchContext): Promise<RawListing[]>;

  /** Normaliseren. Puur, synchroon, geen netwerk — daarom los testbaar. */
  protected abstract normalizeOne(raw: RawListing): unknown;

  async search(criteria: SearchCriteria, context: SourceSearchContext): Promise<PropertyListing[]> {
    const raws = await this.fetchRaw(criteria, context);
    const listings: PropertyListing[] = [];

    for (const raw of raws) {
      if (context.signal.aborted) break;
      if (listings.length >= context.maxResults) break;

      let candidate: unknown;
      try {
        candidate = this.normalizeOne(raw);
      } catch (e) {
        context.logger.warn(
          {
            event: LogEvent.PROPERTY_NORMALIZE_FAILED,
            source: this.name,
            externalId: raw.externalId,
            reason: (e as Error).message,
          },
          "Advertentie kon niet genormaliseerd worden; overgeslagen",
        );
        continue;
      }

      const parsed = propertyListingSchema.safeParse(candidate);
      if (!parsed.success) {
        context.logger.warn(
          {
            event: LogEvent.PROPERTY_NORMALIZE_FAILED,
            source: this.name,
            externalId: raw.externalId,
            issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          },
          "Genormaliseerde advertentie voldeed niet aan het schema; overgeslagen",
        );
        continue;
      }

      listings.push(parsed.data);
    }

    return listings;
  }
}
