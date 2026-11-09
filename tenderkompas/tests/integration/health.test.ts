import { afterAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import { GET } from "@/app/api/health/route";

afterAll(closeDb);

describe("GET /api/health", () => {
  it("geeft 200 en db ok met een bereikbare database, zonder configuratie te lekken", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ status: "ok", db: "ok" });
  });
});
