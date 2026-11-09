"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/actions/types";

/**
 * Marks the install card as seen, so it never comes back for this parent.
 *
 * Stored on the User rather than in browser storage: the card is a one-off
 * piece of onboarding, and a parent who switches from phone to tablet should
 * not be nagged again. No `revalidatePath` here — that truncates the action's
 * own response, and the card hides itself client-side anyway.
 */
export async function dismissInstallHint(): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: "errors.unauthorized" };

    await db.user.update({
      where: { id: session.user.id },
      data: { installHintSeen: true },
    });
  } catch (error) {
    console.error("dismissInstallHint:", error);
    return { error: "errors.generic" };
  }

  return {};
}
