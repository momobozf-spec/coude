import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const SYNC_LEASE_NAME = 'compare-sync';

/**
 * Leases voor achtergrondtaken, veilig over meerdere processen en machines.
 *
 * Een lease is één rij per taaknaam. Claimen is een voorwaardelijke UPDATE:
 * alleen als de lease verlopen is of al van ons. Dat is atomair in Postgres,
 * dus twee gelijktijdige claimers krijgen er precies één. Een houder die
 * crasht, verliest de lease vanzelf na `expiresAt`; een lopende houder
 * verlengt hem met een heartbeat.
 */
@Injectable()
export class JobLeaseService {
  constructor(private readonly prisma: PrismaService) {}

  /** Unieke naam van dit proces, voor de `holder`-kolom. Geen geheim. */
  static newHolderId(): string {
    return `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`;
  }

  async acquire(name: string, holder: string, ttlMs: number, now: Date = new Date()): Promise<boolean> {
    const expiresAt = new Date(now.getTime() + ttlMs);

    const claimed = await this.prisma.jobLease.updateMany({
      where: { name, OR: [{ expiresAt: { lt: now } }, { holder }] },
      data: { holder, expiresAt },
    });
    if (claimed.count === 1) return true;

    try {
      await this.prisma.jobLease.create({ data: { name, holder, expiresAt } });
      return true;
    } catch (error) {
      // P2002: iemand anders heeft de rij net aangemaakt en houdt de lease.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  /** Heartbeat: verlengt alleen een lease die nog van ons is. */
  async renew(name: string, holder: string, ttlMs: number, now: Date = new Date()): Promise<boolean> {
    const result = await this.prisma.jobLease.updateMany({ where: { name, holder }, data: { expiresAt: new Date(now.getTime() + ttlMs) } });
    return result.count === 1;
  }

  /** Geeft de lease vrij door hem te laten verlopen. Alleen de houder kan dat. */
  async release(name: string, holder: string): Promise<void> {
    await this.prisma.jobLease.updateMany({ where: { name, holder }, data: { expiresAt: new Date(0) } });
  }

  async current(name: string): Promise<{ holder: string; expiresAt: Date } | null> {
    const lease = await this.prisma.jobLease.findUnique({ where: { name }, select: { holder: true, expiresAt: true } });
    return lease;
  }
}
