import { readEnv } from './env';
import { createServerRuntime } from './runtime';

/** Scheduler-only process: evaluates schedules and enqueues jobs; workers run elsewhere. Safe to run twice (compare-and-set). */
async function main(): Promise<void> {
  const env = readEnv();
  const runtime = await createServerRuntime(env);
  const supervisor = runtime.createSupervisor({ scheduler: true, workers: false });
  supervisor.start();
  runtime.logger.info('alfred scheduler running', { pollMs: env.pollMs, timezone: env.timezone });
  const shutdown = async () => {
    await runtime.dispose();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main().catch((e: unknown) => {
  console.error('alfred scheduler failed to start', e);
  process.exit(1);
});
