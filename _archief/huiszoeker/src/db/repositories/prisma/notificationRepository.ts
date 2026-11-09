import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { CreateNotificationInput, NotificationRepository } from "../interfaces.js";
import type { NotificationStatus } from "../../../generated/prisma/enums.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- `payload` is een JSON-kolom. */

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateNotificationInput): Promise<{ id: string }> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channelId: input.channelId,
        channel: input.channel,
        payload: input.payload as any,
        matches: { connect: input.matchIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });
    return row;
  }

  async markSent(id: string, at: Date): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: "SENT", sentAt: at, attempts: { increment: 1 }, lastError: null },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: error.slice(0, 1000) },
    });
  }

  async listForUser(
    userId: string,
    limit: number,
  ): Promise<{ id: string; status: NotificationStatus; createdAt: Date }[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, status: true, createdAt: true },
    });
  }
}
