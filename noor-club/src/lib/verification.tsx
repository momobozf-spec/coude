import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { LinkEmail } from "@/emails/LinkEmail";
import { verifyEmailCopy } from "@/emails/copy";
import { toLocale, type Locale } from "@/lib/locales";
import { createToken, hoursFromNow, VERIFY_TOKEN_TTL_HOURS } from "@/lib/tokens";
import { describeError, hashed, logger } from "@/lib/logger";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Issues a fresh verification link and mails it.
 *
 * Never throws: a mail provider having a bad minute must not take down
 * registration. Returns whether the mail actually left, for logging only.
 */
export async function sendVerificationEmail(
  user: { id: string; name: string; email: string },
  locale: Locale | string,
): Promise<boolean> {
  const log = logger("auth.verify");
  const mailLocale = toLocale(String(locale));

  try {
    // One live link at a time, same as password reset.
    await db.emailVerification.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const { token, tokenHash } = createToken();
    await db.emailVerification.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: hoursFromNow(VERIFY_TOKEN_TTL_HOURS),
      },
    });

    const sent = await sendMail({
      to: user.email,
      subject: verifyEmailCopy[mailLocale].subject,
      react: (
        <LinkEmail
          locale={mailLocale}
          name={user.name}
          url={`${APP}/${mailLocale}/e-mail-bevestigen/${token}`}
          copy={verifyEmailCopy[mailLocale]}
        />
      ),
    });

    log.info("verification sent", { user: hashed(user.id), mailSent: sent });
    return sent;
  } catch (error) {
    log.error("verification mail failed", {
      user: hashed(user.id),
      ...describeError(error),
    });
    return false;
  }
}
