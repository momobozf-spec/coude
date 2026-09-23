import { loadWorkerConfig } from './config.js';
import { startWorker } from './worker.js';

const log = {
  info: (m: string) => console.info(`[worker] ${m}`),
  error: (m: string) => console.error(`[worker] ${m}`),
};

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const worker = await startWorker(config, log);
  log.info(`started (${config.env}), ${config.schedules.length} schedule(s)`);
  const shutdown = async (): Promise<void> => {
    log.info('shutting down');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
