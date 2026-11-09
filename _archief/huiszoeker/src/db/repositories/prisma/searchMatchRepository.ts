import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { SearchMatchRepository } from "../interfaces.js";
import type { MatchStatus, SearchMatchRecord, UpsertMatchInput } from "../../../types/domain.js";
import { mapMatch } from "./mappers.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- `reasons` is een JSON-kolom. */

export class PrismaSearchMatchRepository implements SearchMatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: UpsertMatchInput): Promise<{ match: SearchMatchRecord; isNew: boolean }> {
    const existing = await this.prisma.searchMatch.findUnique({
      where: { searchId_propertyId: { searchId: input.searchId, propertyId: input.propertyId } },
      select: { id: true },
    });

    const row = await this.prisma.searchMatch.upsert({
      where: { searchId_propertyId: { searchId: input.searchId, propertyId: input.propertyId } },
      create: {
        searchId: input.searchId,
        propertyId: input.propertyId,
        userId: input.userId,
        score: input.score,
        hardPass: input.hardPass,
        reasons: input.reasons as any,
      },
      // Bij een bestaande match wordt alleen de beoordeling ververst. `status`
      // en `notifiedAt` blijven staan: een pand dat de gebruiker afgewezen
      // heeft, moet afgewezen blijven, ook als de prijs verandert.
      update: {
        score: input.score,
        hardPass: input.hardPass,
        reasons: input.reasons as any,
      },
    });

    return { match: mapMatch(row), isNew: existing === null };
  }

  async findPendingNotification(searchId: string): Promise<SearchMatchRecord[]> {
    const rows = await this.prisma.searchMatch.findMany({
      where: { searchId, hardPass: true, notifiedAt: null, status: { not: "REJECTED" } },
      orderBy: { score: "desc" },
      take: 50,
    });
    return rows.map(mapMatch);
  }

  async markNotified(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.searchMatch.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: at } });
  }

  async setAiSummary(id: string, summary: string, at: Date): Promise<void> {
    await this.prisma.searchMatch.update({
      where: { id },
      data: { aiSummary: summary, aiGeneratedAt: at },
    });
  }

  async setStatus(id: string, userId: string, status: MatchStatus): Promise<SearchMatchRecord | null> {
    const result = await this.prisma.searchMatch.updateMany({ where: { id, userId }, data: { status } });
    if (result.count === 0) return null;
    const row = await this.prisma.searchMatch.findUnique({ where: { id } });
    return row ? mapMatch(row) : null;
  }

  async listForUser(
    userId: string,
    options: { searchId?: string; status?: MatchStatus; limit?: number; offset?: number } = {},
  ): Promise<SearchMatchRecord[]> {
    const rows = await this.prisma.searchMatch.findMany({
      where: {
        userId,
        ...(options.searchId ? { searchId: options.searchId } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
    return rows.map(mapMatch);
  }
}
