import "dotenv/config";
import { getDb } from "@/lib/db";
import { runCollectJob, runDigestJob, runLeadReviveJob, runRetentionJob } from "./pipeline";

async function main() {
  const job = process.argv[2] ?? "all";
  const db = getDb();
  const started = Date.now();
  try {
    if (job === "collect" || job === "all") {
      const r = await runCollectJob(db);
      console.log(JSON.stringify({ job: "collect", ...r }, null, 2));
    }
    if (job === "leadrevive" || job === "all") {
      const r = await runLeadReviveJob(db);
      console.log(JSON.stringify({ job: "leadrevive", results: r }, null, 2));
    }
    if (job === "digest" || job === "all") {
      const r = await runDigestJob(db, { force: process.argv.includes("--force") });
      console.log(JSON.stringify({ job: "digest", ...r }, null, 2));
    }
    if (job === "retention") {
      const r = await runRetentionJob(db);
      console.log(JSON.stringify({ job: "retention", ...r }, null, 2));
    }
    console.log(`done in ${Date.now() - started}ms`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
