/**
 * In-memory repositories voor tests.
 *
 * Deze bestaan omdat de services op interfaces leunen en niet op Prisma. Het
 * resultaat: elke servicetest draait zonder database, zonder Docker en zonder
 * volgorde-afhankelijkheid, in milliseconden.
 *
 * De vergrendelingslogica is hier met opzet exact hetzelfde geformuleerd als in
 * de SQL-variant (claim wanneer vrij óf verlopen), zodat de testen daadwerkelijk
 * het gedrag beschrijven dat de Prisma-implementatie moet hebben. Wat ze niet
 * bewijzen is dat Postgres die UPDATE atomair uitvoert — dat is een eigenschap
 * van de database, niet van onze code, en hoort in een integratietest.
 */
import { randomUUID } from "node:crypto";
import type {
  CreateNotificationInput,
  ListPropertiesOptions,
  ListSearchesOptions,
  NotificationRepository,
  PropertyRepository,
  Repositories,
  SearchMatchRepository,
  SearchRepository,
  SearchRunRepository,
  UserRepository,
} from "../../src/db/repositories/interfaces.js";
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
} from "../../src/types/domain.js";
import type { NotificationStatus } from "../../src/generated/prisma/enums.js";
import type { PropertyListing } from "../../src/schemas/property.js";
import { ConflictError } from "../../src/lib/errors.js";
import { normalizeUrl } from "../../src/lib/url.js";
import { fingerprintForListing } from "../../src/lib/fingerprint.js";

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, UserRecord>();

  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    const found = [...this.users.values()].find((u) => u.email === email.toLowerCase());
    return Promise.resolve(found ?? null);
  }

  ensure(email: string, name?: string): Promise<UserRecord> {
    const normalized = email.toLowerCase();
    const existing = [...this.users.values()].find((u) => u.email === normalized);
    if (existing) return Promise.resolve(existing);
    const user: UserRecord = {
      id: randomUUID(),
      email: normalized,
      name: name ?? null,
      locale: "nl",
      timezone: "Europe/Brussels",
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }
}

export class InMemorySearchRepository implements SearchRepository {
  readonly searches = new Map<string, SearchRecord>();

  create(input: CreateSearchInput): Promise<SearchRecord> {
    const duplicate = [...this.searches.values()].some(
      (s) => s.userId === input.userId && s.name === input.name,
    );
    if (duplicate) {
      return Promise.reject(
        new ConflictError("SEARCH_NAME_TAKEN", `Je hebt al een zoekopdracht met de naam "${input.name}"`),
      );
    }
    const now = new Date();
    const search: SearchRecord = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      originalQuery: input.originalQuery,
      criteria: input.criteria,
      criteriaVersion: input.criteriaVersion,
      parsedBy: input.parsedBy,
      active: input.active ?? true,
      frequency: input.frequency ?? "DAILY",
      lastRunAt: null,
      nextRunAt: now,
      lockedAt: null,
      lockedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    this.searches.set(search.id, search);
    return Promise.resolve({ ...search });
  }

  findForUser(id: string, userId: string): Promise<SearchRecord | null> {
    const found = this.searches.get(id);
    return Promise.resolve(found && found.userId === userId ? { ...found } : null);
  }

  listForUser(userId: string, options: ListSearchesOptions = {}): Promise<SearchRecord[]> {
    const all = [...this.searches.values()]
      .filter((s) => s.userId === userId && (!options.activeOnly || s.active))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options.offset ?? 0;
    return Promise.resolve(all.slice(offset, offset + (options.limit ?? 50)).map((s) => ({ ...s })));
  }

  countForUser(userId: string, options: ListSearchesOptions = {}): Promise<number> {
    return Promise.resolve(
      [...this.searches.values()].filter((s) => s.userId === userId && (!options.activeOnly || s.active)).length,
    );
  }

  update(id: string, userId: string, input: UpdateSearchInput): Promise<SearchRecord | null> {
    const existing = this.searches.get(id);
    if (!existing || existing.userId !== userId) return Promise.resolve(null);

    if (input.name !== undefined) {
      const clash = [...this.searches.values()].some(
        (s) => s.userId === userId && s.name === input.name && s.id !== id,
      );
      if (clash) {
        return Promise.reject(
          new ConflictError("SEARCH_NAME_TAKEN", `Je hebt al een zoekopdracht met de naam "${input.name}"`),
        );
      }
    }

    const updated: SearchRecord = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.originalQuery !== undefined ? { originalQuery: input.originalQuery } : {}),
      ...(input.criteria !== undefined ? { criteria: input.criteria } : {}),
      ...(input.criteriaVersion !== undefined ? { criteriaVersion: input.criteriaVersion } : {}),
      ...(input.parsedBy !== undefined ? { parsedBy: input.parsedBy } : {}),
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.nextRunAt !== undefined ? { nextRunAt: input.nextRunAt } : {}),
      updatedAt: new Date(),
    };
    this.searches.set(id, updated);
    return Promise.resolve({ ...updated });
  }

  delete(id: string, userId: string): Promise<boolean> {
    const existing = this.searches.get(id);
    if (!existing || existing.userId !== userId) return Promise.resolve(false);
    this.searches.delete(id);
    return Promise.resolve(true);
  }

  findDue(now: Date, limit: number): Promise<SearchRecord[]> {
    const due = [...this.searches.values()]
      .filter((s) => s.active && s.nextRunAt.getTime() <= now.getTime())
      .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime())
      .slice(0, limit);
    return Promise.resolve(due.map((s) => ({ ...s })));
  }

  tryAcquireLock(id: string, owner: string, ttlMinutes: number, now = new Date()): Promise<boolean> {
    const search = this.searches.get(id);
    if (!search) return Promise.resolve(false);

    const staleBefore = now.getTime() - ttlMinutes * 60_000;
    const free = search.lockedAt === null || search.lockedAt.getTime() < staleBefore;
    if (!free) return Promise.resolve(false);

    this.searches.set(id, { ...search, lockedAt: now, lockedBy: owner });
    return Promise.resolve(true);
  }

  releaseLock(id: string, owner: string, next: { lastRunAt: Date; nextRunAt: Date }): Promise<void> {
    const search = this.searches.get(id);
    if (!search || search.lockedBy !== owner) return Promise.resolve();
    this.searches.set(id, {
      ...search,
      lockedAt: null,
      lockedBy: null,
      lastRunAt: next.lastRunAt,
      nextRunAt: next.nextRunAt,
    });
    return Promise.resolve();
  }
}

export class InMemorySearchRunRepository implements SearchRunRepository {
  readonly runs = new Map<string, SearchRunRecord>();

  start(searchId: string): Promise<SearchRunRecord> {
    const run: SearchRunRecord = {
      id: randomUUID(),
      searchId,
      status: "RUNNING",
      startedAt: new Date(),
      finishedAt: null,
      scrapedCount: 0,
      newPropertyCount: 0,
      matchCount: 0,
      notifiedCount: 0,
      sourceStats: null,
      error: null,
    };
    this.runs.set(run.id, run);
    return Promise.resolve({ ...run });
  }

  complete(runId: string, totals: SearchRunTotals): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      this.runs.set(runId, { ...run, ...totals, status: "COMPLETED", finishedAt: new Date() });
    }
    return Promise.resolve();
  }

  fail(runId: string, error: string, totals: Partial<SearchRunTotals> = {}): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      this.runs.set(runId, { ...run, ...totals, status: "FAILED", finishedAt: new Date(), error });
    }
    return Promise.resolve();
  }

  listForSearch(searchId: string, limit: number): Promise<SearchRunRecord[]> {
    return Promise.resolve(
      [...this.runs.values()]
        .filter((r) => r.searchId === searchId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, limit),
    );
  }
}

export class InMemoryPropertyRepository implements PropertyRepository {
  readonly properties = new Map<string, PropertyRecord>();

  upsertFromListing(listing: PropertyListing): Promise<PropertyUpsertResult> {
    const urlNormalized = normalizeUrl(listing.url);
    const fingerprint = fingerprintForListing(listing);

    const existing = [...this.properties.values()].find(
      (p) =>
        (p.source === listing.source && p.externalId === listing.externalId) ||
        p.urlNormalized === urlNormalized,
    );

    const next: PropertyRecord = {
      id: existing?.id ?? randomUUID(),
      source: listing.source,
      externalId: listing.externalId,
      url: listing.url,
      urlNormalized,
      fingerprint,
      title: listing.title,
      description: listing.description ?? null,
      address: listing.address ?? null,
      postalCode: listing.postalCode ?? null,
      city: listing.city ?? null,
      region: listing.region ?? null,
      latitude: listing.latitude ?? null,
      longitude: listing.longitude ?? null,
      propertyType: listing.propertyType ?? null,
      transactionType: listing.transactionType === "rent" ? "RENT" : "BUY",
      price: listing.price ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      livingAreaM2: listing.livingAreaM2 ?? null,
      landAreaM2: listing.landAreaM2 ?? null,
      epcLabel: listing.epcLabel ?? null,
      epcValue: listing.epcValue ?? null,
      features: listing.features,
      imageUrl: listing.imageUrl ?? null,
      publishedAt: listing.publishedAt ?? null,
      discoveredAt: existing?.discoveredAt ?? listing.discoveredAt,
      lastSeenAt: new Date(),
      delistedAt: null,
    };

    const changes =
      existing === undefined
        ? []
        : (["price", "bedrooms", "bathrooms", "livingAreaM2", "landAreaM2", "epcLabel", "epcValue", "title"] as const)
            .filter((f) => (existing[f] ?? null) !== (next[f] ?? null))
            .map((f) => ({
              field: f,
              oldValue: existing[f] === null || existing[f] === undefined ? null : String(existing[f]),
              newValue: next[f] === null || next[f] === undefined ? null : String(next[f]),
            }));

    this.properties.set(next.id, next);
    return Promise.resolve({ property: next, isNew: existing === undefined, changes });
  }

  findById(id: string): Promise<PropertyRecord | null> {
    return Promise.resolve(this.properties.get(id) ?? null);
  }

  findByFingerprint(fingerprint: string, excludeId?: string): Promise<PropertyRecord[]> {
    return Promise.resolve(
      [...this.properties.values()].filter((p) => p.fingerprint === fingerprint && p.id !== excludeId),
    );
  }

  list(options: ListPropertiesOptions = {}): Promise<PropertyRecord[]> {
    const all = [...this.properties.values()]
      .filter((p) => (options.city ? p.city?.toLowerCase() === options.city.toLowerCase() : true))
      .filter((p) => (options.source ? p.source === options.source : true))
      .sort((a, b) => b.discoveredAt.getTime() - a.discoveredAt.getTime());
    const offset = options.offset ?? 0;
    return Promise.resolve(all.slice(offset, offset + (options.limit ?? 50)));
  }

  count(options: ListPropertiesOptions = {}): Promise<number> {
    return this.list({ ...options, limit: Number.MAX_SAFE_INTEGER, offset: 0 }).then((r) => r.length);
  }

  markSeen(ids: string[], seenAt: Date): Promise<void> {
    for (const id of ids) {
      const p = this.properties.get(id);
      if (p) this.properties.set(id, { ...p, lastSeenAt: seenAt });
    }
    return Promise.resolve();
  }
}

export class InMemorySearchMatchRepository implements SearchMatchRepository {
  readonly matches = new Map<string, SearchMatchRecord>();

  upsert(input: UpsertMatchInput): Promise<{ match: SearchMatchRecord; isNew: boolean }> {
    const existing = [...this.matches.values()].find(
      (m) => m.searchId === input.searchId && m.propertyId === input.propertyId,
    );
    const match: SearchMatchRecord = existing
      ? { ...existing, score: input.score, hardPass: input.hardPass, reasons: input.reasons }
      : {
          id: randomUUID(),
          searchId: input.searchId,
          propertyId: input.propertyId,
          userId: input.userId,
          score: input.score,
          hardPass: input.hardPass,
          reasons: input.reasons,
          aiSummary: null,
          aiGeneratedAt: null,
          status: "NEW",
          notifiedAt: null,
          createdAt: new Date(),
        };
    this.matches.set(match.id, match);
    return Promise.resolve({ match, isNew: existing === undefined });
  }

  findPendingNotification(searchId: string): Promise<SearchMatchRecord[]> {
    return Promise.resolve(
      [...this.matches.values()]
        .filter((m) => m.searchId === searchId && m.hardPass && m.notifiedAt === null && m.status !== "REJECTED")
        .sort((a, b) => b.score - a.score),
    );
  }

  markNotified(ids: string[], at: Date): Promise<void> {
    for (const id of ids) {
      const m = this.matches.get(id);
      if (m) this.matches.set(id, { ...m, notifiedAt: at });
    }
    return Promise.resolve();
  }

  setAiSummary(id: string, summary: string, at: Date): Promise<void> {
    const m = this.matches.get(id);
    if (m) this.matches.set(id, { ...m, aiSummary: summary, aiGeneratedAt: at });
    return Promise.resolve();
  }

  setStatus(id: string, userId: string, status: MatchStatus): Promise<SearchMatchRecord | null> {
    const m = this.matches.get(id);
    if (!m || m.userId !== userId) return Promise.resolve(null);
    const updated = { ...m, status };
    this.matches.set(id, updated);
    return Promise.resolve(updated);
  }

  listForUser(
    userId: string,
    options: { searchId?: string; status?: MatchStatus; limit?: number; offset?: number } = {},
  ): Promise<SearchMatchRecord[]> {
    const all = [...this.matches.values()]
      .filter((m) => m.userId === userId)
      .filter((m) => (options.searchId ? m.searchId === options.searchId : true))
      .filter((m) => (options.status ? m.status === options.status : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options.offset ?? 0;
    return Promise.resolve(all.slice(offset, offset + (options.limit ?? 50)));
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  readonly notifications = new Map<
    string,
    { id: string; userId: string; status: NotificationStatus; createdAt: Date; matchIds: string[] }
  >();

  create(input: CreateNotificationInput): Promise<{ id: string }> {
    const id = randomUUID();
    this.notifications.set(id, {
      id,
      userId: input.userId,
      status: "PENDING",
      createdAt: new Date(),
      matchIds: input.matchIds,
    });
    return Promise.resolve({ id });
  }

  markSent(id: string): Promise<void> {
    const n = this.notifications.get(id);
    if (n) this.notifications.set(id, { ...n, status: "SENT" });
    return Promise.resolve();
  }

  markFailed(id: string): Promise<void> {
    const n = this.notifications.get(id);
    if (n) this.notifications.set(id, { ...n, status: "FAILED" });
    return Promise.resolve();
  }

  listForUser(userId: string, limit: number): Promise<{ id: string; status: NotificationStatus; createdAt: Date }[]> {
    return Promise.resolve(
      [...this.notifications.values()]
        .filter((n) => n.userId === userId)
        .slice(0, limit)
        .map(({ id, status, createdAt }) => ({ id, status, createdAt })),
    );
  }
}

export function createInMemoryRepositories(): Repositories {
  return {
    users: new InMemoryUserRepository(),
    searches: new InMemorySearchRepository(),
    searchRuns: new InMemorySearchRunRepository(),
    properties: new InMemoryPropertyRepository(),
    matches: new InMemorySearchMatchRepository(),
    notifications: new InMemoryNotificationRepository(),
  };
}
