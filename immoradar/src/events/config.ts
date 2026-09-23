export interface EventEngineConfig {
  /** Minimum relative price change to emit PRICE_DROP / PRICE_INCREASE (0.005 = 0.5%). */
  minPriceChangePct: number;
  /** Number of consecutive collector runs a listing must be missing before it is considered removed. */
  removalConfirmations: number;
  /** Minimum hours since last seen before confirming removal (protects against collector hiccups). */
  removalMinHours: number;
  /** Days within which a new listing on the same property after removal counts as a RELIST. */
  relistWindowDays: number;
  /** Stale thresholds in days. */
  staleDays: readonly [30, 60, 90];
}

export const DEFAULT_EVENT_CONFIG: EventEngineConfig = {
  minPriceChangePct: 0.005,
  removalConfirmations: 2,
  removalMinHours: 24,
  relistWindowDays: 180,
  staleDays: [30, 60, 90],
};
