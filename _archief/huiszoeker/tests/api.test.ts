/**
 * API-tests via `app.inject` — geen poort, geen netwerk, geen database.
 * De app krijgt in-memory repositories en een stub-AI-provider mee.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.js";
import { createInMemoryRepositories } from "./helpers/inMemoryRepositories.js";
import { StubAiProvider } from "./helpers/stubAiProvider.js";
import type { Repositories } from "../src/db/repositories/interfaces.js";

const CRITERIA = {
  transactionType: "buy",
  locations: ["Gent"],
  hardRequirements: { propertyTypes: ["house"], maxPrice: 450_000, minBedrooms: 3 },
  preferences: { features: ["garden"] },
};

let app: FastifyInstance;
let repositories: Repositories;

beforeEach(async () => {
  repositories = createInMemoryRepositories();
  app = await buildApp({
    repositories,
    aiProvider: new StubAiProvider(CRITERIA),
    // De ready-check raakt de database; die testen we hier niet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimale stub
    prismaClient: { $queryRaw: () => Promise.resolve([{ "?column?": 1 }]) } as any,
  });
});

describe("health", () => {
  it("/health werkt zonder gebruiker en zonder database", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("ok");
  });

  it("/ready rapporteert de afzonderlijke checks", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.checks.database.ok).toBe(true);
  });
});

describe("searches", () => {
  it("maakt, leest, wijzigt en verwijdert een zoekopdracht", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/searches",
      payload: { name: "Huis Gent", criteria: CRITERIA },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id as string;
    expect(created.json().data.criteria.hardRequirements.maxPrice).toBe(450_000);

    const list = await app.inject({ method: "GET", url: "/api/searches" });
    expect(list.statusCode).toBe(200);
    expect(list.json().meta.total).toBe(1);

    const one = await app.inject({ method: "GET", url: `/api/searches/${id}` });
    expect(one.json().data.name).toBe("Huis Gent");

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/searches/${id}`,
      payload: { frequency: "HOURLY", active: false },
    });
    expect(patched.json().data.frequency).toBe("HOURLY");
    expect(patched.json().data.active).toBe(false);

    const removed = await app.inject({ method: "DELETE", url: `/api/searches/${id}` });
    expect(removed.statusCode).toBe(204);

    const gone = await app.inject({ method: "GET", url: `/api/searches/${id}` });
    expect(gone.statusCode).toBe(404);
    expect(gone.json().error.code).toBe("SEARCH_NOT_FOUND");
  });

  it("parseert vrije tekst zonder op te slaan", async () => {
    const res = await app.inject({ method: "POST", url: "/api/searches/parse", payload: { query: "Huis in Gent onder 450k" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.criteria.locations).toEqual(["Gent"]);
    expect(res.json().meta.parsedBy).toMatch(/^anthropic:/);

    const list = await app.inject({ method: "GET", url: "/api/searches" });
    expect(list.json().meta.total).toBe(0);
  });

  it("geeft een gestructureerde fout bij ongeldige invoer", async () => {
    const res = await app.inject({ method: "POST", url: "/api/searches", payload: { name: "Zonder inhoud" } });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.requestId).toBeTruthy();
    expect(body.error.details.issues.length).toBeGreaterThan(0);
  });

  it("geeft 409 met een duidelijke code bij een dubbele naam", async () => {
    await app.inject({ method: "POST", url: "/api/searches", payload: { name: "Huis Gent", criteria: CRITERIA } });
    const second = await app.inject({
      method: "POST",
      url: "/api/searches",
      payload: { name: "Huis Gent", criteria: CRITERIA },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("SEARCH_NAME_TAKEN");
  });

  it("start een run en geeft 202", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/searches",
      payload: { criteria: CRITERIA },
    });
    const id = created.json().data.id as string;

    const run = await app.inject({ method: "POST", url: `/api/searches/${id}/run` });
    expect(run.statusCode).toBe(202);
    expect(run.json().data.runId).toBeTruthy();
  });

  it("geeft 409 wanneer een inactieve zoekopdracht gestart wordt", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/searches",
      payload: { criteria: CRITERIA, active: false },
    });
    const id = created.json().data.id as string;

    const run = await app.inject({ method: "POST", url: `/api/searches/${id}/run` });
    expect(run.statusCode).toBe(409);
    expect(run.json().error.code).toBe("SEARCH_INACTIVE");
  });
});

describe("foutafhandeling", () => {
  it("geeft een 404 met envelope voor een onbekende route", async () => {
    const res = await app.inject({ method: "GET", url: "/api/bestaat-niet" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("neemt een meegegeven x-request-id over en geeft hem terug", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "trace-abc-123" },
    });
    expect(res.headers["x-request-id"]).toBe("trace-abc-123");
  });

  it("lekt geen interne details bij een onverwachte fout", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/searches",
      query: { limit: "dit-is-geen-getal" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});
