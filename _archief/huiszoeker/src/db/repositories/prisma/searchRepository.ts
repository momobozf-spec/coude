/**
 * Prisma-implementatie van SearchRepository.
 *
 * Het interessante deel is `tryAcquireLock`. Eén statement:
 *
 *   UPDATE Search SET lockedAt = now, lockedBy = owner
 *   WHERE id = ? AND (lockedAt IS NULL OR lockedAt < now - ttl)
 *
 * Postgres serialiseert dat per rij, dus van twee gelijktijdige workers raakt er
 * precies één de rij en krijgt de ander `count = 0`. Geen extra infrastructuur,
 * geen advisory lock die aan een connectie hangt, en een TTL die een gecrashte
 * worker vanzelf opruimt.
 */
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { ListSearchesOptions, SearchRepository } from "../interfaces.js";
import type { CreateSearchInput, SearchRecord, UpdateSearchInput } from "../../../types/domain.js";
import { ConflictError } from "../../../lib/errors.js";
import { mapSearch } from "./mappers.js";

/**
 * Vertaalt de unique-violation op (userId, name) naar een domeinfout.
 *
 * Dit is precies de reden dat repositories bestaan: een Prisma-foutcode is een
 * implementatiedetail dat nooit tot in een controller of een API-response mag
 * komen. De service ziet een `ConflictError`, meer niet.
 */
function translateUniqueViolation(e: unknown, name: string): unknown {
  const code = (e as { code?: string }).code;
  if (code === "P2002") {
    return new ConflictError("SEARCH_NAME_TAKEN", `Je hebt al een zoekopdracht met de naam "${name}"`);
  }
  return e;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON-kolommen: Prisma
   verwacht InputJsonValue, wij hebben een getypeerd domeinobject. */

export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateSearchInput): Promise<SearchRecord> {
    try {
      const row = await this.prisma.search.create({
        data: {
          userId: input.userId,
          name: input.name,
          originalQuery: input.originalQuery,
          criteria: input.criteria as any,
          criteriaVersion: input.criteriaVersion,
          parsedBy: input.parsedBy,
          frequency: input.frequency ?? "DAILY",
          active: input.active ?? true,
        },
      });
      return mapSearch(row);
    } catch (e) {
      throw translateUniqueViolation(e, input.name);
    }
  }

  async findForUser(id: string, userId: string): Promise<SearchRecord | null> {
    const row = await this.prisma.search.findFirst({ where: { id, userId } });
    return row ? mapSearch(row) : null;
  }

  async listForUser(userId: string, options: ListSearchesOptions = {}): Promise<SearchRecord[]> {
    const rows = await this.prisma.search.findMany({
      where: { userId, ...(options.activeOnly ? { active: true } : {}) },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
    return rows.map(mapSearch);
  }

  countForUser(userId: string, options: ListSearchesOptions = {}): Promise<number> {
    return this.prisma.search.count({
      where: { userId, ...(options.activeOnly ? { active: true } : {}) },
    });
  }

  async update(id: string, userId: string, input: UpdateSearchInput): Promise<SearchRecord | null> {
    try {
      return await this.applyUpdate(id, userId, input);
    } catch (e) {
      throw translateUniqueViolation(e, input.name ?? "");
    }
  }

  private async applyUpdate(
    id: string,
    userId: string,
    input: UpdateSearchInput,
  ): Promise<SearchRecord | null> {
    // updateMany zodat de eigendomscheck in dezelfde query zit als de update.
    const result = await this.prisma.search.updateMany({
      where: { id, userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.originalQuery !== undefined ? { originalQuery: input.originalQuery } : {}),
        ...(input.criteria !== undefined ? { criteria: input.criteria as any } : {}),
        ...(input.criteriaVersion !== undefined ? { criteriaVersion: input.criteriaVersion } : {}),
        ...(input.parsedBy !== undefined ? { parsedBy: input.parsedBy } : {}),
        ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.nextRunAt !== undefined ? { nextRunAt: input.nextRunAt } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findForUser(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.search.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async findDue(now: Date, limit: number): Promise<SearchRecord[]> {
    const rows = await this.prisma.search.findMany({
      where: { active: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: "asc" },
      take: limit,
    });
    return rows.map(mapSearch);
  }

  async tryAcquireLock(id: string, owner: string, ttlMinutes: number, now = new Date()): Promise<boolean> {
    const staleBefore = new Date(now.getTime() - ttlMinutes * 60_000);
    const result = await this.prisma.search.updateMany({
      where: {
        id,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
      },
      data: { lockedAt: now, lockedBy: owner },
    });
    return result.count === 1;
  }

  async releaseLock(
    id: string,
    owner: string,
    next: { lastRunAt: Date; nextRunAt: Date },
  ): Promise<void> {
    // `lockedBy: owner` zodat een worker die zijn slot al kwijt is aan een
    // overname, niet alsnog de tijden van de nieuwe eigenaar overschrijft.
    await this.prisma.search.updateMany({
      where: { id, lockedBy: owner },
      data: {
        lockedAt: null,
        lockedBy: null,
        lastRunAt: next.lastRunAt,
        nextRunAt: next.nextRunAt,
      },
    });
  }
}
