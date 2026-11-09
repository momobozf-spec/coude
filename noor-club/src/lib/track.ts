import { logger, hashed } from "@/lib/logger";

/**
 * The seven funnel events. Deliberately a closed list: an open `track(string)`
 * becomes forty half-used event names within a month, and then nobody trusts
 * the numbers.
 *
 * Today this writes a log line. Swapping in an analytics provider later means
 * changing this one function, not forty call sites.
 */
export type FunnelEvent =
  | "registered"
  | "child_added"
  | "game_started"
  | "game_completed"
  | "pack_completed"
  | "checkout_started"
  | "checkout_completed";

type TrackProps = {
  /** Hashed before it leaves this function — never logged in the clear. */
  userId?: string;
  childId?: string;
  locale?: string;
  packSlug?: string;
  gameSlug?: string;
  engine?: string;
  score?: number;
  durationSec?: number;
  amountCents?: number;
};

export function track(event: FunnelEvent, props: TrackProps = {}): void {
  const { userId, childId, ...rest } = props;

  logger("funnel").info(event, {
    event,
    ...(userId ? { user: hashed(userId) } : {}),
    ...(childId ? { child: hashed(childId) } : {}),
    ...rest,
  });
}
