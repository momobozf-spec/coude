/**
 * CLI voor lokaal werk.
 *
 * Roept exact dezelfde services aan als de REST API. Dat is het punt: als de
 * CLI iets kan wat de API niet kan (of andersom), zit er logica op de verkeerde
 * plek.
 *
 *   npm run search -- "Ik zoek een huis in Gent onder 450000 euro"
 *   npm run search:add -- --name "Huis Gent" --query "..."
 *   npm run search:list
 *   npm run search:run [-- <searchId>]
 */
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma, disconnectPrisma } from "../db/prisma.js";
import { createRepositories } from "../db/repositories/index.js";
import { SearchService } from "../services/searchService.js";
import { isAppError } from "../lib/errors.js";
import type { SearchFrequency } from "../types/domain.js";

const repositories = createRepositories(prisma);
const searchService = new SearchService({
  searches: repositories.searches,
  searchRuns: repositories.searchRuns,
  logger,
  lockTtlMinutes: env.SEARCH_LOCK_TTL_MINUTES,
  workerId: `cli-${process.pid}`,
});

async function currentUserId(): Promise<string> {
  const user = await repositories.users.ensure(env.DEFAULT_USER_EMAIL);
  return user.id;
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function cmdParse(args: string[]): Promise<void> {
  const query = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!query) throw new Error('Gebruik: npm run search -- "je zoekopdracht"');
  const result = await searchService.parse(query);
  console.log(JSON.stringify(result.criteria, null, 2));
  console.log(`\nGeparsed door: ${result.parsedBy}`);
}

async function cmdAdd(args: string[]): Promise<void> {
  const userId = await currentUserId();
  const query = flag(args, "query") ?? args.filter((a) => !a.startsWith("--")).join(" ");
  if (!query) throw new Error('Gebruik: npm run search:add -- --query "je zoekopdracht" [--name "Naam"]');

  const search = await searchService.create(userId, {
    query,
    name: flag(args, "name"),
    frequency: flag(args, "frequency") as SearchFrequency | undefined,
  });
  console.log(`Aangemaakt: ${search.name} (${search.id})`);
  console.log(JSON.stringify(search.criteria, null, 2));
}

async function cmdList(): Promise<void> {
  const userId = await currentUserId();
  const { items, total } = await searchService.list(userId, { limit: 100 });
  if (total === 0) {
    console.log("Nog geen zoekopdrachten. Maak er een met: npm run search:add -- --query \"...\"");
    return;
  }
  for (const s of items) {
    const state = s.active ? "actief" : "uit";
    const last = s.lastRunAt ? s.lastRunAt.toISOString() : "nooit";
    console.log(`${s.id}  ${s.name.padEnd(28)} ${state.padEnd(7)} ${s.frequency.padEnd(14)} laatst: ${last}`);
  }
  console.log(`\n${total} zoekopdracht(en)`);
}

async function cmdRun(args: string[]): Promise<void> {
  const userId = await currentUserId();
  const explicitId = args.find((a) => !a.startsWith("--"));

  const targets = explicitId
    ? [await searchService.get(explicitId, userId)]
    : (await searchService.list(userId, { activeOnly: true, limit: 100 })).items;

  if (targets.length === 0) {
    console.log("Geen actieve zoekopdrachten om uit te voeren.");
    return;
  }

  for (const search of targets) {
    const result = await searchService.runSearch(search, { force: Boolean(explicitId) });
    if (!result.started) {
      console.log(`${search.name}: overgeslagen (${result.reason})`);
      continue;
    }
    const t = result.totals;
    console.log(
      `${search.name}: klaar — ${t?.scrapedCount ?? 0} opgehaald, ${t?.newPropertyCount ?? 0} nieuw, ${t?.matchCount ?? 0} matches, ${t?.notifiedCount ?? 0} gemeld`,
    );
  }
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  search: cmdParse,
  parse: cmdParse,
  add: cmdAdd,
  list: cmdList,
  run: cmdRun,
};

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const handler = command ? COMMANDS[command] : undefined;

  if (!handler) {
    console.log(`Onbekend commando: ${command ?? "(geen)"}\n`);
    console.log("Beschikbaar: " + Object.keys(COMMANDS).join(", "));
    process.exitCode = 1;
    return;
  }

  await handler(args);
}

main()
  .catch((e: unknown) => {
    if (isAppError(e)) {
      console.error(`${e.code}: ${e.message}`);
    } else {
      console.error(e instanceof Error ? e.message : String(e));
    }
    process.exitCode = 1;
  })
  .finally(() => void disconnectPrisma());
