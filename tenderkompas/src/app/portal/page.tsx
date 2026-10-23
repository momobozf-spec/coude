import Link from "next/link";
import { db } from "@/db";
import { requireClient } from "@/lib/dal";
import { listClientOpportunities, FEEDBACK_LABEL } from "@/lib/services/client";
import { AdviceBadge, Badge, Empty, Flash, PageTitle, btn } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { trackAction } from "./actions";

export const metadata = { title: "Kansen" };

const REASON: Record<string, string> = {
  prior_information: "Vooraankondiging — nog geen inschrijving mogelijk",
  awarded: "Gegund",
  cancelled: "Ingetrokken",
  expired: "Deadline verstreken",
  unknown_status: "Status onbekend",
};

export default async function PortalHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await requireClient();
  const items = await listClientOpportunities(db, c.organizationId);
  const tab = sp.tab ?? "open";
  const open = items.filter((i) => i.state.open && i.assessment.advice !== "not_suitable");
  const saved = items.filter((i) => i.tracked);
  const other = items.filter((i) => !(i.state.open && i.assessment.advice !== "not_suitable"));
  const list = tab === "saved" ? saved : tab === "other" ? other : open;
  list.sort((a, b) => {
    const ad = a.state.open && a.state.nextDeadline ? a.state.nextDeadline.getTime() : Infinity;
    const bd = b.state.open && b.state.nextDeadline ? b.state.nextDeadline.getTime() : Infinity;
    return ad - bd;
  });
  const tabs = [
    { key: "open", label: `Relevante open kansen (${open.length})` },
    { key: "saved", label: `Opgeslagen / gevolgd (${saved.length})` },
    { key: "other", label: `Niet passend of afgesloten (${other.length})` },
  ];
  return (
    <div>
      <PageTitle title="Uw kansen" subtitle="Enkel opdrachten die door ons gecontroleerd en goedgekeurd zijn. Een relevantiescore is geen winkans." />
      <Flash searchParams={sp} />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.key} href={`/portal?tab=${t.key}`} className={`rounded-full border px-3 py-1 text-sm ${tab === t.key ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{t.label}</Link>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty>
          {tab === "open"
            ? "Er zijn op dit moment geen gecontroleerde kansen die bij uw profiel passen. We melden het eerlijk wanneer er niets geschikts is — dat is beter dan ruis."
            : "Niets in deze lijst."}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map(({ assessment: a, procedure: p, state, changePending, tracked, latestFeedback }) => (
            <article key={p.id} className="flex flex-col rounded-lg border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdviceBadge advice={a.advice} />
                {a.relevanceScore !== null && <Badge tone="neutral" icon={false}>Relevantie {a.relevanceScore}/100</Badge>}
                {changePending && <Badge tone="warn">Wijziging wordt gecontroleerd</Badge>}
                {!state.open && <Badge tone="neutral">{REASON[state.reason]}</Badge>}
              </div>
              <h2 className="mt-2 text-base font-semibold text-navy-900">
                <Link href={`/portal/kansen/${p.id}`} className="hover:underline">{p.title}</Link>
              </h2>
              <div className="text-sm text-muted">{p.buyerName ?? "Opdrachtgever onbekend"}</div>
              <div className="mt-2 text-sm">
                Eerstvolgende deadline:{" "}
                {state.open ? (state.nextDeadline ? <strong>{formatBrussels(state.nextDeadline)}</strong> : <span className="italic text-warn-700">onbekend — zie details</span>) : "—"}
              </div>
              {a.nextAction && <p className="mt-2 text-sm"><span className="font-semibold">Volgende stap:</span> {a.nextAction}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className="text-xs text-muted">{latestFeedback ? `Uw laatste reactie: ${FEEDBACK_LABEL[latestFeedback.kind]}` : ""}</span>
                <div className="flex gap-2">
                  <form action={trackAction}>
                    <input type="hidden" name="procedureId" value={p.id} />
                    <input type="hidden" name="follow" value={tracked ? "0" : "1"} />
                    <input type="hidden" name="returnTo" value="list" />
                    <button className={btn("ghost", "sm")}>{tracked ? "★ Gevolgd" : "☆ Opslaan"}</button>
                  </form>
                  <Link href={`/portal/kansen/${p.id}`} className={btn("secondary", "sm")}>Details</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
