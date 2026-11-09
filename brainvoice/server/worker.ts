import { readEnv } from './env';
import { createServerRuntime } from './runtime';

/** Worker-only process: claims jobs from the shared database; a separate scheduler enqueues them. */
async function main(): Promise<void> {
  const env = readEnv();
  const runtime = await createServerRuntime(env);
  const supervisor = runtime.createSupervisor({ scheduler: false, workers: true });
  supervisor.start();
  runtime.logger.info('alfred workers running', { host: env.hostName, pollMs: env.pollMs });
  const shutdown = async () => {
    await runtime.dispose();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main().catch((e: unknown) => {
  console.error('alfred worker failed to start', e);
  process.exit(1);
});
