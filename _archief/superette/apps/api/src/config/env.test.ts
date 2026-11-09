import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

// Geldige Ed25519-JWK's (alleen vorm wordt gecontroleerd); geen echte sleutels.
const PRIVATE_JWK = JSON.stringify({ kty: 'OKP', crv: 'Ed25519', d: 'x', x: 'y' });
const PUBLIC_JWK = JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: 'y' });

const base: Record<string, string> = {
  DATABASE_URL: 'postgresql://app:pw@db.example:5432/superette?sslmode=require',
  JWT_SECRET: 'een-geheim-van-minstens-tweeendertig-tekens',
  GATE_SIGNING_PRIVATE_JWK: PRIVATE_JWK,
  GATE_SIGNING_PUBLIC_JWK: PUBLIC_JWK,
  MQTT_ENABLED: 'false',
};

const production: Record<string, string> = {
  ...base,
  NODE_ENV: 'production',
  APP_URL: 'https://shop.example',
  SUPERETTE_WEB_URL: 'https://superette.example',
  TRUST_PROXY: '1',
  MOLLIE_API_KEY: 'test_dummy',
  COMPARE_JOB_KEY: 'een-jobsleutel-van-minstens-16',
};

function expectRejected(env: Record<string, string>, pattern: RegExp): void {
  expect(() => validateEnv(env)).toThrow(pattern);
}

describe('validateEnv in productie', () => {
  it('accepteert een veilige productieconfiguratie', () => {
    const env = validateEnv(production);
    expect(env.NODE_ENV).toBe('production');
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.COMPARE_ALLOW_DEMO).toBeUndefined();
    expect(env.COOKIE_SECURE).toBeUndefined(); // standaard Secure in productie
  });

  it('weigert http-origins', () => {
    expectRejected({ ...production, APP_URL: 'http://shop.example' }, /APP_URL.*https/);
    expectRejected({ ...production, SUPERETTE_WEB_URL: 'http://superette.example' }, /SUPERETTE_WEB_URL.*https/);
  });

  it('weigert onveilige cookies en een ontbrekende proxy-instelling', () => {
    expectRejected({ ...production, COOKIE_SECURE: 'false' }, /COOKIE_SECURE/);
    expectRejected({ ...production, TRUST_PROXY: 'false' }, /TRUST_PROXY/);
  });

  it('weigert demogegevens en te lange tokens', () => {
    expectRejected({ ...production, COMPARE_ALLOW_DEMO: 'true' }, /COMPARE_ALLOW_DEMO/);
    expectRejected({ ...production, JWT_TTL_SECONDS: '7200' }, /JWT_TTL_SECONDS/);
  });

  it('weigert e-mail zonder provider en een provider zonder configuratie', () => {
    expectRejected({ ...production, NOTIFY_EMAIL_ENABLED: 'true' }, /NOTIFY_EMAIL_ENABLED/);
    expectRejected({ ...production, EMAIL_PROVIDER: 'http', EMAIL_FROM: 'x@y' }, /EMAIL_PROVIDER/);
    expectRejected({ ...production, EMAIL_PROVIDER: 'file' }, /EMAIL_FROM/);
  });

  it('weigert zwakke of ontbrekende geheimen', () => {
    expectRejected({ ...production, JWT_SECRET: 'kort' }, /JWT_SECRET/);
    expectRejected({ ...production, COMPARE_JOB_KEY: 'kort' }, /COMPARE_JOB_KEY/);
    expectRejected({ ...production, GATE_SIGNING_PRIVATE_JWK: '{"kty":"RSA"}' }, /GATE_SIGNING_PRIVATE_JWK/);
    const { MOLLIE_API_KEY: _omit, ...withoutMollie } = production;
    expectRejected(withoutMollie, /MOLLIE_API_KEY/);
  });

  it('valideert de DSN van de foutmonitoring', () => {
    expectRejected({ ...production, ERROR_REPORTING_DSN: 'https://geen-sleutel.example/1' }, /ERROR_REPORTING_DSN/);
    expectRejected({ ...production, ERROR_REPORTING_DSN: 'https://key@host.example/' }, /ERROR_REPORTING_DSN/);
    expect(validateEnv({ ...production, ERROR_REPORTING_DSN: 'https://key@host.example/42' }).ERROR_REPORTING_DSN).toBe('https://key@host.example/42');
    expect(validateEnv({ ...production, ERROR_REPORTING_DSN: '' }).ERROR_REPORTING_DSN).toBeUndefined();
  });

  it('weigert een rotatie die niet korter is dan de token-TTL', () => {
    expectRejected({ ...production, ACCESS_TOKEN_TTL_SECONDS: '60', ACCESS_TOKEN_ROTATE_SECONDS: '60' }, /ACCESS_TOKEN_ROTATE_SECONDS/);
  });
});

describe('validateEnv buiten productie', () => {
  it('laat lokale http-origins en demogegevens toe', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'development', COMPARE_ALLOW_DEMO: 'true' });
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.COMPARE_ALLOW_DEMO).toBe(true);
    expect(env.TRUST_PROXY).toBe(false);
  });
});
