/**
 * Voert de `run:`-stappen van de CI-workflow lokaal uit, job na job, met
 * dezelfde omgeving als op GitHub Actions — zonder Actions-runner.
 *
 *   node scripts/ci-local.mjs                       # alle jobs
 *   node scripts/ci-local.mjs --jobs check,smoke    # selectie
 *   node scripts/ci-local.mjs --env DATABASE_URL=… --env CI_ADMIN_URL=…
 *
 * Wat lokaal anders is, wordt gemeld en niet verzwegen:
 *   - `uses:`-stappen (checkout, setup-node, artifacts, gitleaks, docker)
 *     worden overgeslagen; de werkmap vervangt checkout en artifacts;
 *   - `services:` (Postgres) worden niet gestart: geef een draaiende
 *     database mee via --env (CI_DATABASE_URL, CI_ADMIN_URL, DATABASE_URL);
 *   - `${{ env.X }}`, `${{ github.sha }}` en `$GITHUB_ENV` worden ondersteund;
 *     andere expressies niet.
 * Achtergrondprocessen die een stap start (API, app) worden na de job gestopt.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const workflowPath = resolve(repoRoot, '..', '.github', 'workflows', 'superette-ci.yml');
const yaml = createRequire(import.meta.url)('js-yaml');

const args = process.argv.slice(2);
const option = (flag) => (args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? '') : '');
const only = option('--jobs').split(',').filter(Boolean);
const overrides = Object.fromEntries(args.flatMap((a, i) => (a === '--env' ? [args[i + 1].split(/=(.*)/s).slice(0, 2)] : [])));
const skipSteps = option('--skip').split(',').filter(Boolean);

const workflow = yaml.load(readFileSync(workflowPath, 'utf8'));
const githubEnvFile = join(mkdtempSync(join(tmpdir(), 'ci-local-')), 'github.env');
writeFileSync(githubEnvFile, '');
const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim() || 'local';
console.log(`ci-local: workflow ${workflowPath}\n          staplogs in ${dirname(githubEnvFile)}`);

function expand(value, env) {
  return String(value).replace(/\$\{\{\s*env\.([A-Z0-9_]+)\s*\}\}/g, (_, k) => env[k] ?? '').replace(/\$\{\{\s*github\.sha\s*\}\}/g, sha).replace(/\$\{\{\s*secrets\.[A-Z_]+\s*\}\}/g, '');
}

function githubEnv() {
  return Object.fromEntries(
    readFileSync(githubEnvFile, 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
}

const results = [];
const jobs = Object.entries(workflow.jobs).filter(([name]) => only.length === 0 || only.includes(name));

for (const [jobName, job] of jobs) {
  console.log(`\n━━━━━━━━━━ job: ${jobName} (${job.steps.length} stappen${job.services ? `, services: ${Object.keys(job.services).join(',')} → extern` : ''}) ━━━━━━━━━━`);
  const baseEnv = { ...process.env, ...(workflow.env ?? {}), CI: 'true', GITHUB_ENV: githubEnvFile };
  for (const [k, v] of Object.entries(job.env ?? {})) baseEnv[k] = expand(v, baseEnv);
  Object.assign(baseEnv, overrides);
  const cwd = resolve(repoRoot, '..', workflow.defaults?.run?.['working-directory'] ?? '.');
  let jobFailed = false;

  for (const step of job.steps) {
    const name = step.name ?? step.run?.split('\n')[0] ?? step.uses;
    if (step.uses) {
      console.log(`  ↷ overgeslagen (uses: ${step.uses}): ${name}`);
      results.push({ job: jobName, step: name, status: 'SKIPPED (uses)' });
      continue;
    }
    if (skipSteps.some((s) => name.includes(s))) {
      console.log(`  ↷ overgeslagen (--skip): ${name}`);
      results.push({ job: jobName, step: name, status: 'SKIPPED (--skip)' });
      continue;
    }
    // Alleen `runner.os == '…'`-voorwaarden worden begrepen; andere `if:`-expressies niet.
    const osCondition = /runner\.os\s*==\s*'(Linux|Windows|macOS)'/.exec(step.if ?? '');
    const currentOs = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' }[process.platform];
    if (osCondition && osCondition[1] !== currentOs) {
      console.log(`  ↷ overgeslagen (alleen op ${osCondition[1]}): ${name}`);
      results.push({ job: jobName, step: name, status: `SKIPPED (${osCondition[1]})` });
      continue;
    }
    const env = { ...baseEnv, ...githubEnv() };
    for (const [k, v] of Object.entries(step.env ?? {})) env[k] = expand(v, env);
    Object.assign(env, overrides);
    const script = expand(step.run, env);
    const stepCwd = step['working-directory'] ? resolve(cwd, step['working-directory']) : cwd;
    console.log(`  ▶ ${name}`);
    const started = Date.now();
    // Uitvoer naar een bestand, niet naar een pipe: een stap die een server in
    // de achtergrond start (API, app) houdt anders de pipe open en blokkeert
    // spawnSync tot die server stopt (gezien op Windows/MSYS).
    const stepLog = join(dirname(githubEnvFile), `step-${results.length + 1}.log`);
    const fd = openSync(stepLog, 'w');
    const result = spawnSync('bash', ['-eo', 'pipefail', '-c', script], { cwd: stepCwd, env, stdio: ['ignore', fd, fd] });
    closeSync(fd);
    const output = readFileSync(stepLog, 'utf8');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const ok = result.status === 0;
    const tail = output.trim().split('\n').slice(-8).join('\n      ');
    if (ok) {
      console.log(`    ✓ ${seconds} s`);
      results.push({ job: jobName, step: name, status: 'PASS', seconds });
    } else if (step['continue-on-error']) {
      console.log(`    △ mislukt maar continue-on-error (${seconds} s)\n      ${tail}`);
      results.push({ job: jobName, step: name, status: 'FAIL (toegestaan)', seconds });
    } else {
      console.log(`    ✗ exit ${result.status} (${seconds} s)\n      ${tail}`);
      results.push({ job: jobName, step: name, status: 'FAIL', seconds });
      jobFailed = true;
      break;
    }
  }
  // Processen die een stap in de achtergrond startte (API op 4000, app op 3001) opruimen.
  spawnSync('powershell', ['-NoProfile', '-Command', "foreach ($p in 4000,3001) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $x = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($x -and $x.ProcessName -eq 'node') { Stop-Process -Id $x.Id -Force } } }"], { stdio: 'ignore' });
  console.log(jobFailed ? `  ✗ job ${jobName} MISLUKT` : `  ✓ job ${jobName} geslaagd`);
}

console.log('\nSamenvatting');
console.table(results.map((r) => ({ job: r.job, stap: r.step.slice(0, 70), status: r.status, s: r.seconds ?? '' })));
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(failed === 0 ? 'CI-LOCAL: alle uitgevoerde stappen geslaagd' : `CI-LOCAL: ${failed} stap(pen) mislukt`);
process.exit(failed === 0 ? 0 : 1);
