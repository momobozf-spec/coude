import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Nieuw wachtwoord: minstens 10 tekens; bcrypt gebruikt er maximaal 72 bytes. */
export const newPasswordSchema = z.string().min(10).max(72);

const RESET_TTL_MS = 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Maakt een eenmalige herstellink aan voor een account met wachtwoord.
 * Geeft het ruwe token terug (alleen voor de e-mail) of null als er geen
 * account met wachtwoord is. De aanroeper antwoordt in beide gevallen
 * hetzelfde, zodat niet te achterhalen is welke adressen een account hebben.
 */
export async function createPasswordReset(email: string, now = new Date()): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, password: true } });
  if (!user || !user.password) return null;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Oude, nog geldige links vervallen: alleen de laatste werkt.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS) },
    }),
  ]);
  return token;
}

/**
 * Zet een nieuw wachtwoord met een herstellink. Werkt precies één keer en
 * alleen binnen het uur. Bestaande sessies worden ongeldig en een eventuele
 * vergrendeling wordt opgeheven.
 */
export async function resetPasswordWithToken(token: string, newPassword: string, now = new Date()): Promise<boolean> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    const record = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    await tx.user.update({
      where: { id: record.userId },
      data: { password: passwordHash, passwordChangedAt: now, failedLoginAttempts: 0, lockedUntil: null },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } });
    return true;
  });
}

/** Wachtwoord wijzigen vanuit het account (het huidige wachtwoord is nodig). */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  now = new Date(),
): Promise<"ok" | "wrong-password" | "no-password"> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user?.password) return "no-password";
  if (!(await bcrypt.compare(currentPassword, user.password))) return "wrong-password";
  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(newPassword, 12), passwordChangedAt: now },
  });
  return "ok";
}
