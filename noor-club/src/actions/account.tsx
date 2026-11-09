"use server";

import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { requireUser } from "@/lib/entitlement";
import { sendMail } from "@/lib/mail";
import { AccountDeletedEmail } from "@/emails/AccountDeletedEmail";
import { accountDeletedCopy } from "@/emails/copy";
import { toLocale } from "@/lib/locales";
import { deleteAccountSchema, firstIssueKey } from "@/lib/validators";
import { describeError, hashed, logger } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/verification";
import type { ActionResult } from "@/actions/types";

/**
 * Deletes the account and everything attached to it.
 *
 * Stripe first, database second. If cancelling the subscription fails we stop
 * and change nothing: an account deleted while its subscription keeps billing
 * is the one outcome there is no way back from — the customer has no login left
 * to cancel with, and the charges keep coming.
 */
export async function deleteAccount(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const log = logger("account.delete");

  const parsed = deleteAccountSchema.safeParse({
    confirmEmail: String(formData.get("confirmEmail") ?? ""),
    locale: String(formData.get("locale") ?? ""),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  const user = await requireUser();

  // Typed confirmation, not a single click.
  if (parsed.data.confirmEmail !== user.email.toLowerCase()) {
    return { error: "errors.deleteConfirmMismatch" };
  }

  try {
    if (user.stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 20,
      });

      for (const subscription of subscriptions.data) {
        if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
          continue;
        }
        // At period end, not immediately: they paid for this period.
        await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
        });
      }
    }
  } catch (error) {
    log.error("stripe cancel failed, nothing deleted", {
      user: hashed(user.id),
      ...describeError(error),
    });
    return { error: "errors.deleteStripeFailed" };
  }

  const locale = toLocale(user.locale);
  const email = user.email;
  const name = user.name;

  try {
    // Explicit rather than leaning on cascades: this is the one operation where
    // "I assumed the schema would handle it" is not good enough.
    await db.$transaction([
      db.gamePlay.deleteMany({ where: { child: { userId: user.id } } }),
      db.childBadge.deleteMany({ where: { child: { userId: user.id } } }),
      db.child.deleteMany({ where: { userId: user.id } }),
      db.passwordReset.deleteMany({ where: { userId: user.id } }),
      db.emailVerification.deleteMany({ where: { userId: user.id } }),
      db.user.delete({ where: { id: user.id } }),
    ]);

    log.info("account deleted", { user: hashed(user.id) });
  } catch (error) {
    log.error("delete failed", { user: hashed(user.id), ...describeError(error) });
    return { error: "errors.generic" };
  }

  await sendMail({
    to: email,
    subject: accountDeletedCopy[locale].subject,
    react: <AccountDeletedEmail locale={locale} name={name} copy={accountDeletedCopy[locale]} />,
  });

  // Ends the session; the account behind it no longer exists.
  await signOut({ redirectTo: `/${locale}` });
  return {};
}

/** Sends a fresh verification link to the signed-in parent. */
export async function resendVerification(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = toLocale(String(formData.get("locale") ?? ""));
  const user = await requireUser();

  if (user.emailVerifiedAt) return {};

  await sendVerificationEmail(
    { id: user.id, name: user.name, email: user.email },
    locale,
  );

  return { okAt: Date.now() };
}
