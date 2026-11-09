import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireClient } from "@/lib/dal";
import { getClientOpportunity, FEEDBACK_LABEL } from "@/lib/services/client";
import { AssessmentView } from "@/components/assessment-view";
import { Badge, Card, FactLabel, Flash, KeyValue, LifecycleBadge, Notice, PageTitle, Unknown, btn } from "@/components/ui";
import { Evidence, FactValue, LastChecked } from "@/components/evidence";
import { effectiveLifecycle } from "@/lib/domain/lifecycle";
import { FACT_LABEL } from "@/lib/labels";
import { formatBrussels } from "@/lib/time";
import { feedbackAction, trackAction } from "../../actions";

export const metadata = { title: "Kans" };

export default async function OpportunityDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await requireClient();
  const view = await getClientOpportunity(db, c.organizationId, id);
  if (!view) notFound(); // niet gepubliceerd voor deze organisatie ⇒ bestaat niet voor de klant
  const { assessment: a, bundle, state, changePending, tracked, feedback } = view;
  const p = bundle.procedure;
  const facts = bundle.facts.filter((f) => !f.supersededAt && f.verificationStatus !== "rejected" && f.verificationStatus !== "evidence_not_found");
  const lotName = (lotId: string | null) => (lotId ? bundle.lots.find((l) => l.id === lotId)?.lotKey ?? "?" : "Alle percelen");
  const sourceLinks = bundle.notices.filter((n) => n.url);

  return (
    <div className="space-y-5">
      <PageTitle
        title={p.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.buyerName ?? "Opdrachtgever onbekend"} · <LifecycleBadge lifecycle={effectiveLifecycle(p)} />
            {p.titleLanguage && p.titleLanguage !== "NLD" && <Badge tone="neutral">Bron in {p.titleLanguage}</Badge>}
            <LastChecked at={p.lastCheckedAt} />
          </span>
        }
        actions={
          <form action={trackAction}>
            <input type="hidden" name="procedureId" value={p.id} />
            <input type="hidden" name="follow" value={tracked ? "0" : "1"} />
            <button className={btn(tracked ? "secondary" : "primary", "sm")}>{tracked ? "★ Gevolgd — niet meer volgen" : "☆ Opslaan en wijzigingen volgen"}</button>
          </form>
        }
      />
      <Flash searchParams={sp} />
      {changePending && (
        <Notice tone="warn" title="Wijziging in de bron wordt gecontroleerd">
          Na deze beoordeling (gepubliceerd op {a.publishedAt ? formatBrussels(a.publishedAt) : "?"}) is de bron gewijzigd of herberekend. Wij controleren de wijziging; tot dan kan deze analyse verouderd zijn. Controleer de officiële bron vóór u beslist.
        </Notice>
      )}
      {!state.open && (
        <Notice tone="bad" title="Geen open inschrijvingskans">
          {state.reason === "prior_information" ? "Dit is een vooraankondiging: indienen is nog niet mogelijk." : state.reason === "awarded" ? "Deze opdracht is gegund." : state.reason === "cancelled" ? "Deze opdracht is ingetrokken of stopgezet." : state.reason === "expired" ? "Alle bekende deadlines zijn verstreken." : "Status onbekend."}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Samenvatting van de vraag">
          {p.summaryNl ? (
            <>
              <div className="mb-2 flex gap-2">
                {p.summaryIsTranslation && <Badge tone="info">Vertaalde samenvatting — bron in oorspronkelijke taal</Badge>}
                {!p.summaryVerified && <Badge tone="warn">Samenvatting niet volledig gecontroleerd</Badge>}
              </div>
              <p className="whitespace-pre-line text-sm">{p.summaryNl}</p>
            </>
          ) : (
            <p className="text-sm"><Unknown>Nog geen samenvatting beschikbaar.</Unknown></p>
          )}
          {p.description && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-navy-700">Oorspronkelijke omschrijving (brontaal)</summary>
              <p className="mt-2 whitespace-pre-line text-muted">{p.description}</p>
            </details>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2">Kerngegevens <FactLabel /></span>}>
          <KeyValue
            items={[
              ["Proceduretype", p.procedureType],
              ["Plaats van uitvoering", p.performanceNuts.length || p.performanceCountries.length ? [...p.performanceNuts, ...p.performanceCountries].join(", ") : null],
              ["Land opdrachtgever", p.buyerCountry],
              ["Taal procedure", p.officialLanguages.join(", ") || null],
              ["CPV", p.cpvCodes.join(", ") || null],
              ["Percelen", bundle.lots.length ? bundle.lots.map((l) => `${l.lotKey}${l.title ? ` — ${l.title}` : ""}`).join("; ") : "geen percelen geregistreerd"],
              ["Officiële bron", sourceLinks.length ? <span key="s" className="space-y-1">{sourceLinks.map((n) => <a key={n.id} className="block underline" href={n.url!} target="_blank" rel="noreferrer noopener">{n.publicationNumber.split("#")[0]}</a>)}</span> : null],
            ]}
          />
        </Card>
      </div>

      <Card title={<span className="flex items-center gap-2">Deadlines, waarde en looptijd <FactLabel /></span>}>
        {facts.length === 0 ? <Notice tone="warn">Nog geen deadlines of waarden vastgesteld in de bron.</Notice> : (
          <table className="tk">
            <thead><tr><th>Gegeven</th><th>Perceel</th><th>Waarde</th><th>Bron</th></tr></thead>
            <tbody>
              {facts.map((f) => (
                <tr key={f.id}>
                  <td className="text-sm">{FACT_LABEL[f.key]}</td>
                  <td className="text-xs">{lotName(f.lotId)}</td>
                  <td><FactValue f={f} /></td>
                  <td className="max-w-sm"><Evidence item={f} docs={bundle.documents} notices={bundle.notices} docHref={(d) => `/api/documents/${d}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AssessmentView a={a} bundle={bundle} docHref={(d) => `/api/documents/${d}`} audience="client" />

      <Card title="Uw reactie">
        <p className="mb-3 text-sm text-muted">Uw feedback blijft binnen uw organisatie en helpt ons de selectie te verbeteren.</p>
        <div className="flex flex-wrap gap-2">
          {(["interesting", "investigating", "bid_submitted", "won", "lost"] as const).map((k) => (
            <form key={k} action={feedbackAction}>
              <input type="hidden" name="procedureId" value={p.id} />
              <input type="hidden" name="kind" value={k} />
              <button className={btn("secondary", "sm")}>{FEEDBACK_LABEL[k]}</button>
            </form>
          ))}
        </div>
        <form action={feedbackAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="procedureId" value={p.id} />
          <input type="hidden" name="kind" value="not_relevant" />
          <input type="text" name="reason" required placeholder="Waarom niet relevant? (verplicht)" className="max-w-md" />
          <button className={btn("danger", "sm")}>Niet relevant</button>
        </form>
        {feedback.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {feedback.map((f) => <li key={f.id}>{formatBrussels(f.createdAt)} — {FEEDBACK_LABEL[f.kind]}{f.reason ? `: ${f.reason}` : ""}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
