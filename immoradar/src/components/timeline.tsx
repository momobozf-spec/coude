import type { ListingEventType, ListingStatus } from "@/generated/prisma/enums";
import { formatDate, formatPrice } from "@/lib/format";

export interface TimelineEntry {
  at: Date;
  kind: "event" | "snapshot";
  type: ListingEventType | "SNAPSHOT";
  title: string;
  detail?: string;
  oldPrice?: number | null;
  newPrice?: number | null;
  sourceName?: string;
}

const EVENT_TITLES: Record<ListingEventType, string> = {
  NEW_LISTING: "Listing detected",
  FSBO_DETECTED: "Private seller detected",
  PRICE_DROP: "Price drop",
  PRICE_INCREASE: "Price increase",
  STALE_30: "30 days on the market",
  STALE_60: "60 days on the market",
  STALE_90: "90 days on the market",
  LISTING_REMOVED: "Listing removed",
  RELISTED: "Relisted",
  AGENCY_TO_PRIVATE: "Agency mandate ended — now private",
  PRIVATE_TO_AGENCY: "Now listed by an agency",
};

const TONE: Record<string, string> = {
  PRICE_DROP: "bg-warm-600",
  PRICE_INCREASE: "bg-ink-500",
  FSBO_DETECTED: "bg-good-600",
  AGENCY_TO_PRIVATE: "bg-good-600",
  RELISTED: "bg-hot-600",
  LISTING_REMOVED: "bg-ink-400",
  NEW_LISTING: "bg-brand-600",
};

/** Build a chronological property timeline from listings, events and snapshots. */
export function buildTimeline(listings: Array<{ source: { name: string }; sellerType: string; events: Array<{ type: ListingEventType; occurredAt: Date; oldPrice: number | null; newPrice: number | null; percentage: number | null; payload: unknown }>; snapshots: Array<{ capturedAt: Date; price: number | null; status: ListingStatus; sellerType: string }> }>): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const l of listings) {
    for (const e of l.events) {
      let detail: string | undefined;
      if (e.type === "PRICE_DROP" || e.type === "PRICE_INCREASE" || e.type === "RELISTED") {
        detail = e.percentage !== null ? `${e.percentage > 0 ? "+" : ""}${e.percentage.toFixed(2)}%` : undefined;
      } else if (e.type === "NEW_LISTING" || e.type === "FSBO_DETECTED") {
        detail = l.sellerType === "PRIVATE" ? "Private seller" : l.sellerType === "PROFESSIONAL" ? "Agency listing" : undefined;
      } else if (e.type === "LISTING_REMOVED") {
        const reason = (e.payload as { reason?: string } | null)?.reason;
        detail = reason === "missing_confirmed" ? "Confirmed after repeated absence" : reason === "source_reported" ? "Reported by source" : undefined;
      }
      entries.push({ at: e.occurredAt, kind: "event", type: e.type, title: EVENT_TITLES[e.type], detail, oldPrice: e.oldPrice, newPrice: e.newPrice ?? (e.type === "NEW_LISTING" ? l.snapshots[0]?.price : undefined), sourceName: l.source.name });
    }
  }
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) return <p className="text-sm text-ink-500">No history yet.</p>;
  return (
    <ol className="relative ml-2 border-l border-ink-200">
      {entries.map((e, i) => (
        <li key={i} className="mb-5 ml-5">
          <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${TONE[e.type] ?? "bg-ink-300"}`} />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{formatDate(e.at)}</p>
          <p className="text-sm font-medium text-ink-900">{e.title}</p>
          {e.oldPrice && e.newPrice && e.oldPrice !== e.newPrice ? (
            <p className="text-sm tabular-nums text-ink-700">
              {formatPrice(e.oldPrice)} <span className="text-ink-400">→</span> <span className="font-semibold">{formatPrice(e.newPrice)}</span>
              {e.detail ? <span className="ml-2 text-xs text-ink-500">{e.detail}</span> : null}
            </p>
          ) : e.newPrice ? (
            <p className="text-sm tabular-nums text-ink-700">{formatPrice(e.newPrice)}{e.detail ? <span className="ml-2 text-xs text-ink-500">{e.detail}</span> : null}</p>
          ) : e.detail ? (
            <p className="text-xs text-ink-500">{e.detail}</p>
          ) : null}
          {e.sourceName ? <p className="text-xs text-ink-400">{e.sourceName}</p> : null}
        </li>
      ))}
    </ol>
  );
}
