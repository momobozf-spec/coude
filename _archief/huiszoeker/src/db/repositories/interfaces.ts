/**
 * De contracten waar de services op leunen.
 *
 * Services krijgen deze interfaces via de constructor, nooit de PrismaClient.
 * Daardoor draaien alle service-tests op in-memory implementaties: geen
 * database, geen Docker, geen testvolgorde-afhankelijkheden.
 *
 * Twee dingen die opvallen en bewust zijn:
 *
 *  - Elke leesmethode neemt `userId`. Geen "haal op en check daarna of het van
 *    jou is": de eigendomscheck zit in de query, zodat vergeten onmogelijk is.
 *  - `tryAcquireLock` geeft een boolean, geen record. De aanroeper hoeft niet te
 *    weten hóe het slot werkt; alleen of hij mag draaien.
 */
import type {
  CreateSearchInput,
  MatchStatus,
  PropertyRecord,
  PropertyUpsertResult,
  SearchMatchRecord,
  SearchRecord,
  SearchRunRecord,
  SearchRunTotals,
  UpdateSearchInput,
  UpsertMatchInput,
  UserRecord,
} from "../../types/domain.js";
import type { PropertyListing } from "../../schemas/property.js";
import type { NotificationChannelType, NotificationStatus } from "../../generated/prisma/enums.js";

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  /** Idempotent; gebruikt door de seed en door de dev-auth-middleware. */
  ensure(email: string, name?: string): Promise<UserRecord>;
}

export interface ListSearchesOptions {
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchRepository {
  create(input: CreateSearchInput): Promise<SearchRecord>;
  /** Altijd met `userId`: een zoekopdracht van iemand anders bestaat niet. */
  findForUser(id: string, userId: string): Promise<SearchRecord | null>;
  listForUser(userId: string, options?: ListSearchesOptions): Promise<SearchRecord[]>;
  countForUser(userId: string, options?: ListSearchesOptions): Promise<number>;
  update(id: string, userId: string, input: UpdateSearchInput): Promise<SearchRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;

  /** Voor de scheduler: actieve zoekopdrachten waarvan `nextRunAt` verstreken is. */
  findDue(now: Date, limit: number): Promise<SearchRecord[]>;

  /**
   * Claimt het slot atomair. `true` betekent: jij mag draaien. `false` betekent
   * dat iemand anders al bezig is, of dat de zoekopdracht niet meer bestaat.
   * Een slot ouder dan `ttlMinutes` wordt overgenomen — anders blokkeert een
   * gecrashte worker de zoekopdracht voor altijd.
   */
  tryAcquireLock(id: string, owner: string, ttlMinutes: number, now?: Date): Promise<boolean>;

  /** Geeft het slot vrij en zet `lastRunAt` / `nextRunAt`. Draait in een finally. */
  releaseLock(id: string, owner: string, next: { lastRunAt: Date; nextRunAt: Date }): Promise<void>;
}

export interface SearchRunRepository {
  start(searchId: string): Promise<SearchRunRecord>;
  complete(runId: string, totals: SearchRunTotals): Promise<void>;
  fail(runId: string, error: string, totals?: Partial<SearchRunTotals>): Promise<void>;
  listForSearch(searchId: string, limit: number): Promise<SearchRunRecord[]>;
}

export interface ListPropertiesOptions {
  city?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export interface PropertyRepository {
  /**
   * Ontdubbelt en schrijft weg. Geeft terug of het pand nieuw was en welke
   * velden gewijzigd zijn, zodat de aanroeper geen tweede query nodig heeft om
   * dat te bepalen.
   */
  upsertFromListing(listing: PropertyListing): Promise<PropertyUpsertResult>;
  findById(id: string): Promise<PropertyRecord | null>;
  /**
   * Panden met dezelfde vingerafdruk — dezelfde woning op een andere site.
   * Bewust geen automatische merge: de matching engine gebruikt dit om een
   * tweede melding te onderdrukken, terwijl beide bronrijen intact blijven.
   */
  findByFingerprint(fingerprint: string, excludeId?: string): Promise<PropertyRecord[]>;
  list(options?: ListPropertiesOptions): Promise<PropertyRecord[]>;
  count(options?: ListPropertiesOptions): Promise<number>;
  markSeen(ids: string[], seenAt: Date): Promise<void>;
}

export interface SearchMatchRepository {
  upsert(input: UpsertMatchInput): Promise<{ match: SearchMatchRecord; isNew: boolean }>;
  /** Matches die nog gemeld moeten worden: `hardPass` en `notifiedAt == null`. */
  findPendingNotification(searchId: string): Promise<SearchMatchRecord[]>;
  markNotified(ids: string[], at: Date): Promise<void>;
  setAiSummary(id: string, summary: string, at: Date): Promise<void>;
  setStatus(id: string, userId: string, status: MatchStatus): Promise<SearchMatchRecord | null>;
  listForUser(userId: string, options?: { searchId?: string; status?: MatchStatus; limit?: number; offset?: number }): Promise<SearchMatchRecord[]>;
}

export interface CreateNotificationInput {
  userId: string;
  channelId: string;
  channel: NotificationChannelType;
  payload: unknown;
  matchIds: string[];
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<{ id: string }>;
  markSent(id: string, at: Date): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  listForUser(userId: string, limit: number): Promise<{ id: string; status: NotificationStatus; createdAt: Date }[]>;
}

/** Alles bij elkaar; wat een service binnenkrijgt. */
export interface Repositories {
  users: UserRepository;
  searches: SearchRepository;
  searchRuns: SearchRunRepository;
  properties: PropertyRepository;
  matches: SearchMatchRepository;
  notifications: NotificationRepository;
}
