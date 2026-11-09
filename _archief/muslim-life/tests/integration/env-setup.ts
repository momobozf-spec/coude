/**
 * Runs before any test module is imported.
 *
 * Services import the Prisma singleton, which reads `DATABASE_URL` at module
 * load. Pointing that at the test database here means the integration tests
 * exercise the real service code paths rather than a parallel implementation.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
