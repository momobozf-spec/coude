import type { ListingEventType } from "@/generated/prisma/enums";

export interface DetectedEvent {
  type: ListingEventType;
  occurredAt: Date;
  oldPrice?: number | null;
  newPrice?: number | null;
  difference?: number | null;
  percentage?: number | null;
  /** Deterministic key to guarantee idempotency across runs. */
  dedupeKey: string;
  payload?: Record<string, unknown>;
}
