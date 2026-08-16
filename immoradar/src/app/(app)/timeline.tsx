import { describeEvent } from "@/services/opportunity-service";
import type { ListingEventType } from "@/generated/prisma";

export function Timeline({
  events,
}: {
  events: { id: string; type: ListingEventType; occurredAt: Date; payload: unknown }[];
}) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {events.map((event) => {
        const p = (event.payload ?? {}) as Record<string, unknown>;
        const isDrop = event.type === "PRICE_DROP";
        const isRise = event.type === "PRICE_INCREASE";
        return (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-[22px] top-1 h-3 w-3 rounded-full ring-2 ring-white ${
                isDrop
                  ? "bg-emerald-500"
                  : isRise
                    ? "bg-red-400"
                    : event.type === "LISTING_REMOVED"
                      ? "bg-slate-400"
                      : event.type === "RELISTED" || event.type === "FSBO_DETECTED"
                        ? "bg-indigo-500"
                        : "bg-slate-300"
              }`}
            />
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {event.occurredAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <div className="text-sm font-medium text-slate-800">{describeEvent(event.type, event.payload)}</div>
            {(isDrop || isRise) && typeof p.oldPrice === "number" && typeof p.newPrice === "number" ? (
              <div className="mt-0.5 text-sm text-slate-500">
                €{(p.oldPrice as number).toLocaleString("nl-BE")} <span className="mx-1">→</span>
                <span className={isDrop ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>
                  €{(p.newPrice as number).toLocaleString("nl-BE")}
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
