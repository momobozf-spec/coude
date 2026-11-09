/**
 * Every mutation in this app returns this shape. `error` is an i18n *key*
 * (e.g. "errors.emailTaken"), never prose — the client renders it with `t()`,
 * which keeps rule 10 intact across the server/client boundary.
 */
export type ActionResult = {
  error?: string;
  /** Set when a mutation succeeded without navigating, so the UI can confirm it. */
  okAt?: number;
  /**
   * Absolute, locale-prefixed path to send the parent to once the mutation has
   * succeeded. The *client* performs this navigation (see `useActionRedirect`).
   *
   * Why not `redirect()` inside the action: in this Next 15 + next-intl setup a
   * Server Action redirect whose target lives in the same route group is
   * acknowledged by the client router but never committed — the mutation
   * succeeds while the parent keeps looking at the previous page. Redirects
   * that cross route groups (login, logout) are unaffected and still use
   * `redirect()` normally.
   */
  redirectTo?: string;
};

export const EMPTY_RESULT: ActionResult = {};
