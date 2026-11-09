import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { SearchRunRepository } from "../interfaces.js";
import type { SearchRunRecord, SearchRunTotals } from "../../../types/domain.js";
import { mapSearchRun } from "./mappers.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- sourceStats is een JSON-kolom. */

export class PrismaSearchRunRepository implements SearchRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async start(searchId: string): Promise<SearchRunRecord> {
    const row = await this.prisma.searchRun.create({ data: { searchId, status: "RUNNING" } });
    return mapSearchRun(row);
  }

  async complete(runId: string, totals: SearchRunTotals): Promise<void> {
    await this.prisma.searchRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        scrapedCount: totals.scrapedCount,
        newPropertyCount: totals.newPropertyCount,
        matchCount: totals.matchCount,
        notifiedCount: totals.notifiedCount,
        ...(totals.sourceStats !== undefined ? { sourceStats: totals.sourceStats as any } : {}),
      },
    });
  }

  async fail(runId: string, error: string, totals: Partial<SearchRunTotals> = {}): Promise<void> {
    await this.prisma.searchRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        // Fouten worden afgekapt: een stacktrace van 40 kB in een auditkolom
        // helpt niemand en maakt de tabel onleesbaar.
        error: error.slice(0, 2000),
        ...(totals.scrapedCount !== undefined ? { scrapedCount: totals.scrapedCount } : {}),
        ...(totals.newPropertyCount !== undefined ? { newPropertyCount: totals.newPropertyCount } : {}),
        ...(totals.matchCount !== undefined ? { matchCount: totals.matchCount } : {}),
        ...(totals.notifiedCount !== undefined ? { notifiedCount: totals.notifiedCount } : {}),
        ...(totals.sourceStats !== undefined ? { sourceStats: totals.sourceStats as any } : {}),
      },
    });
  }

  async listForSearch(searchId: string, limit: number): Promise<SearchRunRecord[]> {
    const rows = await this.prisma.searchRun.findMany({
      where: { searchId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return rows.map(mapSearchRun);
  }
}
