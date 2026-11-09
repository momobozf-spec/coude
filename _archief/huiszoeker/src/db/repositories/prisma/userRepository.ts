import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { UserRepository } from "../interfaces.js";
import type { UserRecord } from "../../../types/domain.js";
import { mapUser } from "./mappers.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? mapUser(row) : null;
  }

  async ensure(email: string, name?: string): Promise<UserRecord> {
    const row = await this.prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: { email: email.toLowerCase(), name: name ?? null },
    });
    return mapUser(row);
  }
}
