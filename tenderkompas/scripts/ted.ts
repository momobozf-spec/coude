/**
 * TED-hulpmiddelen.
 *   npm run ted:import            incrementele import (vanaf cursor; eerste keer 14 dagen)
 *   npm run ted:sample            importeert de laatste 90 dagen en print het steekproefrapport
 *   npm run ted:verify-fields     test elk veld afzonderlijk tegen de live API (checkQuerySyntax + 1 resultaat)
 * Voor een scheduler (cron, Azure Container Apps job, ...) volstaat `npm run ted:import`.
 */
import "dotenv/config";
import { db, closeDb } from "@/db";
import { ensureSources } from "@/lib/services/sources";
import { runTedImport } from "@/lib/ted/importer";
import { sampleReport } from "@/lib/ted/sample";
import { TED_FIELDS } from "@/lib/ted/fields";
import { tedSearchPage } from "@/lib/ted/client";
import { buildTedQuery } from "@/lib/ted/query";

async function main() {
  const cmd = process.argv[2];
  await ensureSources(db);
  if (cmd === "import" || cmd === "sample") {
    const to = new Date();
    const from = cmd === "sample" ? new Date(to.getTime() - 90 * 86_400_000) : undefined;
    const res = await runTedImport(db, { trigger: cmd === "sample" ? "sample" : "schedule", actorUserId: null, from, to });
    const r = res.run;
    console.log(`Status: ${r.status} | gerapporteerd door TED: ${r.totalReported ?? "?"} | opgehaald: ${r.fetchedCount} | nieuwe procedures: ${r.newProcedures} | nieuwe publicaties: ${r.newNotices} | gewijzigd: ${r.changedProcedures} | dubbel: ${r.duplicateNotices}`);
    if (r.errorMessage) console.log(`Fouten: ${r.errorMessage}`);
    if (cmd === "sample") {
      const rep = await sampleReport(db, 90);
      console.log("\n=== Steekproef laatste 90 dagen ===");
      console.log(`Query: ${r.query}`);
      if (!rep.available) console.log(rep.message);
      else
        console.log(
          JSON.stringify(
            {
              periodeVanaf: rep.since.toISOString().slice(0, 10),
              tedProcedures: rep.totalProcedures,
              potentieelRelevanteProcedures: rep.relevantProcedures,
              percelenBijRelevanteProcedures: rep.relevantLots,
              relevanteProceduresZonderPerceelinfo: rep.relevantWithoutLots,
              perStatus: rep.byLifecycle,
            },
            null,
            2,
          ),
        );
    }
    if (r.status === "failed") process.exitCode = 2;
    return;
  }
  if (cmd === "verify-fields") {
    const q = buildTedQuery({ from: new Date(Date.now() - 30 * 86_400_000), to: new Date() });
    for (const [field, status] of Object.entries(TED_FIELDS)) {
      try {
        await tedSearchPage({ query: q, fields: ["publication-number", field], limit: 1, page: 1, scope: "ALL", paginationMode: "PAGE_NUMBER" }, { maxRetries: 2 });
        console.log(`OK        ${field} (${status})`);
      } catch (e) {
        console.log(`GEWEIGERD ${field} (${status}): ${e instanceof Error ? e.message.slice(0, 160) : e}`);
      }
    }
    return;
  }
  console.log("Gebruik: tsx scripts/ted.ts import|sample|verify-fields");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
