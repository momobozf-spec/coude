import { db } from "@/db";
import { source } from "@/db/schema";
import { Badge, Card, Notice, PageTitle } from "@/components/ui";
import { formatBrussels } from "@/lib/time";

export const metadata = { title: "Bronnen & dekking" };

export default async function PortalSources() {
  const sources = (await db.select().from(source)).filter((s) => s.id !== "demo");
  return (
    <div className="max-w-4xl space-y-4">
      <PageTitle title="Bronnen en dekking" subtitle="Wat we opvolgen — en wat niet." />
      <Notice tone="warn">We volgen niet alle Belgische overheidsopdrachten. Er is geen garantie op volledigheid, toelating of gunning.</Notice>
      {sources.map((s) => (
        <Card key={s.id} title={s.name}>
          <p className="text-sm">{s.coverageNote}</p>
          <div className="mt-2 text-sm">
            {s.automation === "api" ? (
              <>
                Automatische opvolging · laatste geslaagde verwerking: <strong>{s.lastSuccessAt ? formatBrussels(s.lastSuccessAt) : "nog niet"}</strong>{" "}
                {s.lastRunStatus && s.lastRunStatus !== "success" && <Badge tone="bad">laatste poging: {s.lastRunStatus}</Badge>}
              </>
            ) : (
              <Badge tone="neutral">Handmatige invoer door de beheerder</Badge>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
