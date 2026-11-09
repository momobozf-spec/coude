"use client";

import { useEffect } from "react";

/**
 * Navigates once a server action has come back with a destination.
 *
 * This is a full document navigation on purpose. The soft alternatives were
 * each measured against this app and each fails for a different reason:
 *
 *   - `redirect()` inside the action: the client acknowledges the redirect but
 *     never commits it when the target sits in the same route group;
 *   - `router.push()` from inside the form action: fetches the destination's
 *     RSC payload and then drops it, because it is nested inside React's own
 *     action transition.
 *
 * These mutations are rare (adding, renaming or removing a child), so paying
 * for one document load buys a result that is simply always correct — and the
 * destination renders fresh, with no cache invalidation to reason about.
 */
export function useActionRedirect(redirectTo: string | undefined) {
  useEffect(() => {
    if (redirectTo) window.location.assign(redirectTo);
  }, [redirectTo]);
}
