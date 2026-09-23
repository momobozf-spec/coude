/** Environment for integration tests (real PostgreSQL, no Redis, in-process jobs). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://superrette:superrette@localhost:5432/superrette_test';

export function applyTestEnv(): void {
  process.env.APP_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
  process.env.JOBS_MODE = 'inline';
  process.env.PUSH_MODE = 'log';
  process.env.OPEN_PRICES_ENABLED = 'false';
  process.env.OPEN_FOOD_FACTS_ENABLED = 'false';
  delete process.env.REDIS_URL;
}
