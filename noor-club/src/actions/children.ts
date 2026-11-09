"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  childCreateSchema,
  childIdSchema,
  childUpdateSchema,
  firstIssueKey,
  localeSchema,
} from "@/lib/validators";
import { toLocale } from "@/lib/locales";
import { describeError, hashed, logger } from "@/lib/logger";
import { track } from "@/lib/track";
import type { ActionResult } from "@/actions/types";

/** Guard rail against a runaway loop or a bored child hammering "add". */
const MAX_CHILDREN = 12;

/**
 * These actions finish by handing a destination back to the client rather than
 * calling `redirect()` themselves — see the note on `ActionResult.redirectTo`
 * for the measurement behind that choice.
 *
 * They also deliberately do NOT call `revalidatePath`. Revalidating inside an
 * action that the client is still reading cuts the response stream short: the
 * mutation lands, but the form never learns that it finished and sits on its
 * pending label forever. The client answers with a full-document navigation,
 * so the destination is rendered fresh regardless and there is nothing stale
 * left to invalidate.
 */

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function createChildAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = toLocale(String(formData.get("locale") ?? ""));

  const parsed = childCreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    avatar: String(formData.get("avatar") ?? "fox"),
    ageBand: String(formData.get("ageBand") ?? "4-6"),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  let childId: string;

  try {
    const userId = await currentUserId();
    if (!userId) return { error: "errors.unauthorized" };

    const count = await db.child.count({ where: { userId } });
    if (count >= MAX_CHILDREN) return { error: "errors.tooManyChildren" };

    const child = await db.child.create({
      data: {
        name: parsed.data.name,
        avatar: parsed.data.avatar,
        ageBand: parsed.data.ageBand,
        userId,
      },
      select: { id: true },
    });
    childId = child.id;
    track("child_added", { userId, childId, locale });
  } catch (error) {
    logger("children.create").error("create failed", describeError(error));
    return { error: "errors.generic" };
  }

  // Straight to the new child's page — where the parent wants to be next.
  return { redirectTo: `/${locale}/kind/${childId}` };
}

export async function updateChildAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = toLocale(String(formData.get("locale") ?? ""));

  const parsed = childUpdateSchema.safeParse({
    childId: String(formData.get("childId") ?? ""),
    name: String(formData.get("name") ?? ""),
    avatar: String(formData.get("avatar") ?? "fox"),
    ageBand: String(formData.get("ageBand") ?? "4-6"),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  try {
    const userId = await currentUserId();
    if (!userId) return { error: "errors.unauthorized" };

    // `updateMany` with userId in the where clause makes ownership part of the
    // query itself: a foreign childId simply matches zero rows.
    const result = await db.child.updateMany({
      where: { id: parsed.data.childId, userId },
      data: {
        name: parsed.data.name,
        avatar: parsed.data.avatar,
        ageBand: parsed.data.ageBand,
      },
    });
    if (result.count === 0) return { error: "errors.childNotFound" };
  } catch (error) {
    console.error("updateChildAction:", error);
    return { error: "errors.generic" };
  }

  return { redirectTo: `/${locale}/kind/${parsed.data.childId}` };
}

export async function deleteChildAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = toLocale(String(formData.get("locale") ?? ""));

  const parsed = childIdSchema.safeParse({
    childId: String(formData.get("childId") ?? ""),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  try {
    const userId = await currentUserId();
    if (!userId) return { error: "errors.unauthorized" };

    await db.child.deleteMany({ where: { id: parsed.data.childId, userId } });
  } catch (error) {
    console.error("deleteChildAction:", error);
    return { error: "errors.generic" };
  }

  return { redirectTo: `/${locale}/kinderen` };
}

export async function setLocaleAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = localeSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
  });
  if (!parsed.success) return { error: firstIssueKey(parsed.error) };

  try {
    const userId = await currentUserId();
    if (!userId) return { error: "errors.unauthorized" };

    await db.user.update({
      where: { id: userId },
      data: { locale: parsed.data.locale },
    });
  } catch (error) {
    console.error("setLocaleAction:", error);
    return { error: "errors.generic" };
  }

  // Same reasoning as above: the caller navigates, so there is nothing to
  // invalidate, and revalidating here would truncate this response.
  return {};
}
