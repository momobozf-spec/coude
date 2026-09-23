import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { getPipelineBoard } from "@/repositories/opportunities";
import { humanize, formatPrice } from "@/lib/format";
import { PageHeader, ScoreBadge } from "@/components/ui";
import { STATUS_ORDER } from "@/services/workflow";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { ctx } = await requireTenant();
  const board = await getPipelineBoard(db, ctx);
  const columns = STATUS_ORDER.filter((s) => s !== "DISMISSED");
  return (
    <>
      <PageHeader title="Acquisition Pipeline" subtitle="Lightweight lifecycle from detection to mandate. Not a replacement for your CRM." />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((status) => (
          <div key={status} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-600">{humanize(status)}</h2>
              <span className="text-xs tabular-nums text-ink-400">{board[status].length}</span>
            </div>
            <div className="space-y-2">
              {board[status].slice(0, 30).map((o) => (
                <Link key={o.id} href={`/opportunities/${o.id}`} className="card block p-3 hover:border-brand-500">
                  <div className="flex items-start gap-2">
                    <ScoreBadge score={o.score} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.headline}</p>
                      <p className="truncate text-xs text-ink-500">{o.property?.addressLine ?? o.contact?.city ?? ""}</p>
                      <p className="text-xs text-ink-500">{formatPrice(o.listing?.currentPrice ?? o.priceAtDetection)} · {o.assignedUser?.name ?? "Unassigned"}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {board[status].length > 30 ? <p className="px-1 text-xs text-ink-400">+{board[status].length - 30} more</p> : null}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-500">Dismissed: {board.DISMISSED.length}</p>
    </>
  );
}
