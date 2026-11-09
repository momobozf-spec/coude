/**
 * `BOUTIQUE_ENABLED`: met de vlag uit (standaard, ook in productie) laadt de
 * API de boetiekmodules niet en geven alle boetiekroutes 404; health, auth,
 * account, consent en de vergelijker blijven. Met de vlag aan bestaan ze wel.
 *
 * Echte `AppModule.forRoot()` over HTTP; alleen Prisma is vervangen (geen DB).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MqttService } from './gate/mqtt.service';
import { PrismaService } from './prisma/prisma.service';

/** Elke Prisma-aanroep geeft "niets" terug; geen verbinding. */
function fakePrisma(): unknown {
  const model = new Proxy({}, { get: () => async () => null });
  return new Proxy(
    { $connect: async () => undefined, $disconnect: async () => undefined, $queryRaw: async () => [{ ok: 1 }] },
    { get: (target, property) => (property in target ? target[property as keyof typeof target] : property === 'then' ? undefined : model) },
  );
}

const BASE_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://app:pw@db.example:5432/superette',
  JWT_SECRET: 'een-geheim-van-minstens-tweeendertig-tekens-lang',
  MQTT_ENABLED: 'false',
  COMPARE_ALLOW_DEMO: 'false',
};

const BOUTIQUE_ROUTES: ReadonlyArray<[method: string, path: string]> = [
  ['POST', '/auth/register'],
  ['POST', '/access/token'],
  ['POST', '/gate/unlock'],
  ['POST', '/gate/exit'],
  ['GET', '/baskets/open'],
  ['POST', '/baskets/scan'],
  ['POST', '/checkout'],
  ['GET', '/receipts'],
  ['POST', '/webhooks/mollie'],
  ['GET', '/stores'],
];

async function startApp(env: Record<string, string>): Promise<{ app: INestApplication; url: string }> {
  for (const key of ['BOUTIQUE_ENABLED', 'GATE_SIGNING_PRIVATE_JWK', 'GATE_SIGNING_PUBLIC_JWK']) delete process.env[key];
  Object.assign(process.env, BASE_ENV, env);

  const moduleRef = await Test.createTestingModule({ imports: [await AppModule.forRoot()] })
    .overrideProvider(PrismaService)
    .useValue(fakePrisma())
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as { port: number };
  return { app, url: `http://127.0.0.1:${port}/api/v1` };
}

const call = (url: string, method: string, path: string) =>
  fetch(`${url}${path}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });

describe('BOUTIQUE_ENABLED', () => {
  let running: INestApplication | null = null;

  afterEach(async () => {
    await running?.close();
    running = null;
  });

  it('uit (standaard): boetiekroutes 404, MQTT niet geladen, de rest werkt', async () => {
    const { app, url } = await startApp({});
    running = app;

    for (const [method, path] of BOUTIQUE_ROUTES) {
      const response = await call(url, method, path);
      expect(response.status, `${method} ${path}`).toBe(404);
    }
    expect(() => app.get(MqttService, { strict: false })).toThrow();

    expect((await call(url, 'GET', '/health/live')).status).toBe(200);
    // Bestaan wel (401 = route gevonden, aanmelding vereist):
    expect((await call(url, 'GET', '/auth/me')).status).toBe(401);
    expect((await call(url, 'GET', '/account/export')).status).toBe(401);
    expect((await call(url, 'GET', '/consents')).status).toBe(401);
    expect((await call(url, 'GET', '/compare/lists')).status).toBe(401);
    // Registratie voor de vergelijker blijft (400 = validatie, niet 404):
    expect((await call(url, 'POST', '/auth/register-superette')).status).toBe(400);
  });

  it('aan: de boetiekroutes bestaan', async () => {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
    const { app, url } = await startApp({
      BOUTIQUE_ENABLED: 'true',
      GATE_SIGNING_PRIVATE_JWK: JSON.stringify(await exportJWK(privateKey)),
      GATE_SIGNING_PUBLIC_JWK: JSON.stringify(await exportJWK(publicKey)),
    });
    running = app;

    for (const [method, path] of BOUTIQUE_ROUTES) {
      const response = await call(url, method, path);
      expect(response.status, `${method} ${path}`).not.toBe(404);
    }
    expect(app.get(MqttService, { strict: false })).toBeInstanceOf(MqttService);
  });
});
