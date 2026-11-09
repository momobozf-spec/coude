"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { LinkEmail } from "@/emails/LinkEmail";
import { passwordResetCopy } from "@/emails/copy";
import { toLocale } from "@/lib/locales";
import {
  firstIssueKey,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validators";
import {
  createToken,
  hashToken,
  isUsable,
  minutesFromNow,
  RESET_TOKEN_TTL_MINUTES,
} from "@/lib/tokens";
import { RATE_LIMITS, consume } from "@/lib/rate-limit";
import { describeError, hashed, logger } from "@/lib/logger";
import type { ActionResult } from "@/actions/types";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Always answers the same, whether or not the address is registered.
 *
 * Anything else turns this form into a membership oracle: type an address,
 * read the response, learn whether that family has an account here. The rate
 * limit is applied per address for the same reason — so it cannot be used to
 * enumerate either.
 */
export async function requestPasswordReset(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const log = logger("auth.forgot");

  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    locale: String(formData.get("locale") ?? ""),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  const { email, locale } = parsed.data;

  const allowed = await consume(RATE_LIMITS.forgotEmail, email);
  if (!allowed.allowed) {
    log.warn("rate limited", { email: hashed(email) });
    return { error: "errors.tooManyAttemptsHour" };
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, locale: true },
    });

    if (user) {
      // Any older link stops working the moment a new one is asked for.
      await db.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const { token, tokenHash } = createToken();
      await db.passwordReset.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: minutesFromNow(RESET_TOKEN_TTL_MINUTES),
        },
      });

      const mailLocale = toLocale(user.locale);
      const sent = await sendMail({
        to: user.email,
        subject: passwordResetCopy[mailLocale].subject,
        react: (
          <LinkEmail
            locale={mailLocale}
            name={user.name}
            url={`${APP}/${mailLocale}/wachtwoord-herstellen/${token}`}
            copy={passwordResetCopy[mailLocale]}
          />
        ),
      });

      log.info("reset requested", { user: hashed(user.id), mailSent: sent });
    } else {
      log.info("reset requested for unknown address", { email: hashed(email) });
    }
  } catch (error) {
    log.error("reset request failed", describeError(error));
    // Still the same answer: a failure here must not reveal anything either.
  }

  void locale;
  return {};
}

export async function resetPassword(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const log = logger("auth.reset");

  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    locale: String(formData.get("locale") ?? ""),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  try {
    const record = await db.passwordReset.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!record || !isUsable(record)) {
      log.warn("token rejected", { found: record !== null });
      return { error: "errors.resetTokenInvalid" };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    // Marking the token used and changing the password in one transaction, so a
    // crash between the two cannot leave a link that still works.
    await db.$transaction([
      db.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      db.passwordReset.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    log.info("password reset", { user: hashed(record.userId) });
  } catch (error) {
    log.error("reset failed", describeError(error));
    return { error: "errors.generic" };
  }

  return {};
}
