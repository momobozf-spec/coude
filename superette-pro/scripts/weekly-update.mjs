/**
 * Wekelijkse prijsupdate in één commando.
 *
 *   npm run weekly
 *
 * Doet na elkaar:
 *  1. scrape:delhaize, scrape:aldi, scrape:lidl  (faalt er één, dan blijft het
 *     vorige importbestand van die keten staan en gaan we gewoon door);
 *  2. import:ah  — alleen als apps/api/data/ah-paginas opgeslagen pagina's van
 *     de afgelopen 8 dagen bevat; anders overgeslagen met een melding;
 *  3. compare:sync voor alle ketens met een importbestand (ook de handmatige
 *     Carrefour/Jumbo/Spar-bestanden; oude prijzen worden vanzelf VEROUDERD/VERLOPEN);
 *  4. match:report.
 * Op het einde: een overzicht per stap.
 *
 * Vereist: de database draait (terminal 1). DATABASE_URL en SCRAPE_CONTACT
 * worden uit .env gelezen als ze niet al in de omgeving staan; ze worden nooit
 * getoond.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const AH_DIR = join(root, 'apps', 'api', 'data', 'ah-paginas');
const FEED_DIR = join(root, 'apps', 'api', 'data', 'feeds');
const AH_MAX_AGE_DAYS = 8;

function loadEnvKey(key) {
  if (process.env[key]) return;
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`).exec(line);
    if (match) {
      process.env[key] = match[1].trim().replace(/^["']|["']$/g, '');
      return;
    }
  }
}

loadEnvKey('DATABASE_URL');
loadEnvKey('SCRAPE_CONTACT');

if (!process.env.DATABASE_URL) {
  console.error('✖ DATABASE_URL ontbreekt (niet in de omgeving en niet in .env). Gestopt.');
  process.exit(1);
}
if (!process.env.SCRAPE_CONTACT) {
  console.error('✖ SCRAPE_CONTACT ontbreekt. Zet het in .env (SCRAPE_CONTACT=jouw@mail) of in deze terminal. Gestopt.');
  process.exit(1);
}

const results = [];

function run(label, args) {
  console.log(`\n━━━ ${label} ━━━`);
  const started = Date.now();
  const outcome = spawnSync('npm', ['run', ...args], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: process.env });
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  const code = outcome.status ?? 1;
  const status = code === 0 ? '✔ ok' : code === 2 ? '⚠ geblokkeerd/gestopt (vorig bestand blijft)' : `✖ fout (code ${code})`;
  results.push({ stap: label, status, minuten: minutes });
  return code === 0;
}

function skip(label, reason) {
  console.log(`\n━━━ ${label} ━━━\n– overgeslagen: ${reason}`);
  results.push({ stap: label, status: `– overgeslagen: ${reason}`, minuten: '0.0' });
}

// 1. Automatische ketens.
run('Delhaize scrapen', ['scrape:delhaize']);
run('ALDI scrapen', ['scrape:aldi']);
run('Lidl scrapen', ['scrape:lidl']);

// 2. AH: alleen met recente, zelf opgeslagen pagina's.
const freshAhPages = existsSync(AH_DIR)
  ? readdirSync(AH_DIR).filter((name) => {
      if (!/\.html?$/i.test(name)) return false;
      const ageDays = (Date.now() - statSync(join(AH_DIR, name)).mtimeMs) / 86_400_000;
      return ageDays <= AH_MAX_AGE_DAYS;
    })
  : [];
if (freshAhPages.length > 0) {
  run(`AH importeren (${freshAhPages.length} pagina's)`, ['import:ah', '--', AH_DIR]);
} else {
  skip('AH importeren', `geen opgeslagen pagina's van de laatste ${AH_MAX_AGE_DAYS} dagen in apps\\api\\data\\ah-paginas`);
}

// 3. Inladen: alle ketens waarvoor een importbestand bestaat.
const chains = ['delhaize', 'aldi', 'lidl', 'albert-heijn', 'carrefour', 'jumbo', 'spar'].filter((chain) => existsSync(join(FEED_DIR, `${chain}.json`)));
if (chains.length > 0) run(`Sync (${chains.join(', ')})`, ['compare:sync', '--', ...chains]);
else skip('Sync', 'geen importbestanden gevonden');

// 4. Overzicht van de matches.
run('Matchrapport', ['match:report']);

console.log('\n━━━ Overzicht ━━━');
console.table(results);
const failed = results.filter((row) => row.status.startsWith('✖')).length;
console.log(failed === 0 ? '\nKlaar. Nieuwe kandidaat-paren beoordelen: npm run match:review\n' : `\n${failed} stap(pen) mislukt; zie hierboven.\n`);
process.exitCode = failed === 0 ? 0 : 1;
