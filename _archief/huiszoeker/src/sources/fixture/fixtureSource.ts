/**
 * Offline bron met lokale advertenties.
 *
 * Dit is geen speelgoed: het is de bron waarmee de hele pijplijn —
 * normaliseren, ontdubbelen, matchen, AI, melden — draait en getest wordt
 * zonder één externe request. Daardoor zijn de tests deterministisch en kan een
 * demo draaien zonder dat er ook maar iets aan hoeft te staan.
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SearchCriteria } from "../../schemas/searchCriteria.js";
import { BaseSource } from "../base/BaseSource.js";
import type { RawListing, SourceKind, SourceSearchContext } from "../types.js";

export const FIXTURE_SOURCE_NAME = "fixture";

const DEFAULT_FIXTURE_PATH = join(process.cwd(), "fixtures", "listings.json");

export class FixtureSource extends BaseSource {
  readonly name = FIXTURE_SOURCE_NAME;
  readonly kind: SourceKind = "fixture";

  private readonly listings: unknown[];

  constructor(listings?: unknown[], fixturePath: string = DEFAULT_FIXTURE_PATH) {
    super();
    this.listings = listings ?? loadFixtures(fixturePath);
  }

  protected fetchRaw(_criteria: SearchCriteria, context: SourceSearchContext): Promise<RawListing[]> {
    const now = new Date();
    const raws = this.listings.slice(0, context.maxResults).map((payload, index) => {
      const record = payload as Record<string, unknown>;
      const externalId = typeof record.externalId === "string" ? record.externalId : `fixture-${index}`;
      const url = typeof record.url === "string" ? record.url : `https://example.com/fixture/${externalId}`;
      return { source: this.name, externalId, url, payload, fetchedAt: now };
    });
    return Promise.resolve(raws);
  }

  protected normalizeOne(raw: RawListing): unknown {
    // Fixtures staan al in het interne formaat; alleen bron en id worden
    // afgedwongen zodat een slordige fixture geen andere bron kan nabootsen.
    return {
      ...(raw.payload as Record<string, unknown>),
      source: this.name,
      externalId: raw.externalId,
      url: raw.url,
    };
  }
}

function loadFixtures(path: string): unknown[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}
