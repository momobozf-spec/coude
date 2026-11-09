import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { TrialReminderEmail } from "@/emails/TrialReminderEmail";
import { reminderCopy } from "@/emails/copy";
import { toLocale } from "@/lib/locales";
import { describeError, hashed, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** How many trial days must remain for the reminder to go out. */
const REMIND_FROM_DAYS = 6;
const REMIND_UNTIL_DAYS = 8;
const DAY_MS = 86_400_000;

/**
 * One daily job: the renewal reminder plus housekeeping.
 *
 * Everything here is idempotent. Vercel can retry a cron, and two runs on the
 * same day must not send a parent two mails — `renewalReminderSentAt` is what
 * guarantees that, not the schedule.
 */
export async function GET(request: Request) {
  const log = logger("cron.daily");

  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");

  if (!secret || provided !== `Bearer ${secret}`) {
    log.warn("unauthorized cron call");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = { reminders: 0, rateLimits: 0, resetTokens: 0, verifyTokens: 0 };

  try {
    /* ---------------------------------------------- 1. renewal reminders -- */

    const due = await db.user.findMany({
      where: {
        subStatus: "TRIALING",
        renewalReminderSentAt: null,
        trialEndsAt: {
          gte: new Date(now.getTime() + REMIND_FROM_DAYS * DAY_MS),
          lte: new Date(now.getTime() + REMIND_UNTIL_DAYS * DAY_MS),
        },
      },
      select: { id: true, email: true, name: true, locale: true, trialEndsAt: true },
      take: 200,
    });

    for (const user of due) {
      if (!user.trialEndsAt) continue;

      const locale = toLocale(user.locale);
      const chargeDate = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        user.trialEndsAt,
      );

      const sent = await sendMail({
        to: user.email,
        subject: reminderCopy[locale].subject,
        react: (
          <TrialReminderEmail
            locale={locale}
            name={user.name}
            chargeDate={chargeDate}
            accountUrl={`${APP}/${locale}/account`}
          />
        ),
      });

      if (sent) {
        // Only marked once the mail actually left, so a provider outage means a
        // retry tomorrow rather than a parent who is never warned.
        await db.user.update({
          where: { id: user.id },
          data: { renewalReminderSentAt: new Date() },
        });
        result.reminders += 1;
      } else {
        log.warn("reminder not sent", { user: hashed(user.id) });
      }
    }

    /* -------------------------------------------------- 2. housekeeping -- */

    result.rateLimits = (
      await db.rateLimit.deleteMany({ where: { windowEnd: { lt: now } } })
    ).count;

    result.resetTokens = (
      await db.passwordReset.deleteMany({ where: { expiresAt: { lt: now } } })
    ).count;

    result.verifyTokens = (
      await db.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } })
    ).count;

    log.info("cron finished", { ...result, candidates: due.length });
    return NextResponse.json({ ok: true, candidates: due.length, ...result });
  } catch (error) {
    log.error("cron failed", { ...result, ...describeError(error) });
    return NextResponse.json({ error: "failed", ...result }, { status: 500 });
  }
}
