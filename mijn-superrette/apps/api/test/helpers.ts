import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { applyTestEnv } from './env.js';

applyTestEnv();

export async function bootApp(): Promise<INestApplication> {
  const { createApp } = await import('../src/bootstrap.js');
  const app = await createApp();
  await app.init();
  return app;
}

export class Client {
  constructor(
    private readonly app: INestApplication,
    public token: string | null = null,
  ) {}

  private http(): ReturnType<typeof request> {
    return request(this.app.getHttpServer() as App);
  }

  private auth<T extends request.Test>(req: T): T {
    return this.token ? (req.set('Authorization', `Bearer ${this.token}`) as T) : req;
  }

  get(path: string): request.Test {
    return this.auth(this.http().get(path));
  }
  post(path: string, body: unknown = {}): request.Test {
    return this.auth(
      this.http()
        .post(path)
        .send(body as object),
    );
  }
  put(path: string, body: unknown = {}): request.Test {
    return this.auth(
      this.http()
        .put(path)
        .send(body as object),
    );
  }
  patch(path: string, body: unknown = {}): request.Test {
    return this.auth(
      this.http()
        .patch(path)
        .send(body as object),
    );
  }
  delete(path: string): request.Test {
    return this.auth(this.http().delete(path));
  }
}

export async function login(app: INestApplication, email: string, password = 'superrette-dev'): Promise<Client> {
  const res = await new Client(app).post('/v1/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return new Client(app, res.body.accessToken as string);
}

let counter = 0;
export async function registerUser(
  app: INestApplication,
  name = 'Tester',
): Promise<{ client: Client; email: string; userId: string }> {
  const email = `user${Date.now()}${counter++}@test.local`;
  const res = await new Client(app).post('/v1/auth/register', {
    email,
    password: 'correct-horse-battery',
    displayName: name,
    locale: 'nl',
    countryCode: 'BE',
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client: new Client(app, res.body.accessToken as string), email, userId: res.body.user.id as string };
}

export async function retailerIds(app: INestApplication, slugs: string[]): Promise<Record<string, string>> {
  const res = await new Client(app).get('/v1/retailers?country=BE');
  const out: Record<string, string> = {};
  for (const r of res.body as { id: string; slug: string }[]) if (slugs.includes(r.slug)) out[r.slug] = r.id;
  return out;
}
