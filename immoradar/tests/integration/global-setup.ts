import "dotenv/config";
import { execSync } from "node:child_process";

/** Apply migrations to the test database once per test run. */
export default function globalSetup(): void {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    console.warn("[integration] TEST_DATABASE_URL not set — integration tests will be skipped");
    return;
  }
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
