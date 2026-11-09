import { readFileSync } from 'node:fs';

import { readEnv } from './env';
import { createHttpServer } from './http';
import { createServerRuntime, SERVER_VERSION } from './runtime';

/**
 * Alfred API process. With ALFRED_EMBEDDED_WORKERS=1 (default) it also runs the scheduler
 * and all workers, which is the simplest 24/7 deployment: one container, one database.
 *   npm run dev        – API + workers + scheduler with reload
 *   npm run worker     – workers only
 *   npm run scheduler  – scheduler only
 * HTTPS: set ALFRED_TLS_CERT / ALFRED_TLS_KEY, or terminate TLS in a reverse proxy
 * (then set ALFRED_TRUST_PROXY=1 so rate limits see the client address).
 */
async function main(): Promise<void> {
  const env = readEnv();
  if (!env.apiToken && !env.allowAnonymous) {
    console.error('ALFRED_API_TOKEN is not set. Set it (or ALFRED_ALLOW_ANONYMOUS=1 for local development only).');
    process.exit(1);
  }
  const runtime = await createServerRuntime(env);
  const supervisor = env.embeddedWorkers ? runtime.createSupervisor({ scheduler: true, workers: true }) : null;
  supervisor?.start();

  const tls = env.tls ? { cert: readFileSync(env.tls.certPath), key: readFileSync(env.tls.keyPath) } : null;
  const server = createHttpServer({ client: runtime.client, token: env.apiToken, allowAnonymous: env.allowAnonymous, logger: runtime.logger.child('http'), version: SERVER_VERSION, ready: runtime.ready, accounts: runtime.accounts, rateLimitPerMinute: env.rateLimitPerMinute, trustProxy: env.trustProxy, tls });
  server.listen(env.port, env.host, () => {
    runtime.logger.info('alfred server listening', { host: env.host, port: env.port, https: Boolean(tls), database: runtime.db.driver.dialect, embeddedWorkers: env.embeddedWorkers, ai: runtime.aiConfigured, email: env.emailProvider, gmailConfigured: Boolean(env.gmail), credentialsPersistent: runtime.credentialsPersistent, home: Boolean(env.hassUrl), repo: env.repoPath ?? null, anonymous: env.allowAnonymous });
  });

  const shutdown = async (signal: string) => {
    runtime.logger.info('shutting down', { signal });
    server.close();
    await runtime.dispose();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((e: unknown) => {
  console.error('alfred server failed to start', e);
  process.exit(1);
});
