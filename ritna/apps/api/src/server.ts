import { DbNotifier, FakePaymentProvider, StraightLineRouting } from './adapters.js';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import type { Ctx } from './context.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';
import { processExpiries } from './services/rides.js';

const config = loadConfig();
const db = createPool(config.databaseUrl);
await migrate(db, console.log);

if (process.env.NODE_ENV === 'production') {
  // Bewuste stop: de fake-provider en rechtelijnroutering zijn niet geschikt voor echte ritten.
  throw new Error('Productie vereist een echte betaal- en routeringsprovider (zie README: Vóór lancering)');
}

const ctx: Ctx = {
  db,
  payments: new FakePaymentProvider(),
  routing: new StraightLineRouting(),
  notifier: new DbNotifier(),
  now: () => new Date(),
  commissionVatBps: config.commissionVatBps,
};

const app = await buildApp(ctx, { jwtSecret: config.jwtSecret, logger: true });

const timer = setInterval(() => {
  processExpiries(ctx).catch((e) => app.log.error(e, 'processExpiries mislukt'));
}, config.tickIntervalMs);

const shutdown = async () => {
  clearInterval(timer);
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: '0.0.0.0' });
