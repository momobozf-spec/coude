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

/** Productie zoals gedeployd: alleen de vergelijker (boetiek uit, standaard). */
const production: Record<string, string> = {
  DATABASE_URL: base['DATABASE_URL']!,
  JWT_SECRET: base['JWT_SECRET']!,
  NODE_ENV: 'production',
  SUPERETTE_WEB_URL: 'https://superette.example',
  TRUST_PROXY: '1',
  COMPARE_JOB_KEY: 'Jq8vN2xR5tK9mW3pL7zH4cB6yF1dG0sA',
  LEGAL_ENTITY_ADDRESS: 'Teststraat 1, 1930 Zaventem',
};

/** Productie mét boetiek (niet de huidige productie; voor de boetiekregels). */
const productionBoutique: Record<string, string> = {
  ...production,
  BOUTIQUE_ENABLED: 'true',
  APP_URL: 'https://shop.example',
  GATE_SIGNING_PRIVATE_JWK: PRIVATE_JWK,
  GATE_SIGNING_PUBLIC_JWK: PUBLIC_JWK,
  MQTT_ENABLED: 'false',
  MOLLIE_API_KEY: 'live_dummy',
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
    expectRejected({ ...productionBoutique, APP_URL: 'http://shop.example' }, /APP_URL.*https/);
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
    const { MOLLIE_API_KEY: _omit, ...withoutMollie } = productionBoutique;
    expectRejected(withoutMollie, /MOLLIE_API_KEY/);
  });

  it('weigert standaard- en plaatshoudergeheimen', () => {
    expectRejected({ ...production, JWT_SECRET: 'vervang-dit-door-32-plus-random-bytes' }, /JWT_SECRET.*zwak/);
    expectRejected({ ...production, JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, /JWT_SECRET/);
    expectRejected({ ...production, COMPARE_JOB_KEY: 'een-jobsleutel-van-minstens-16' }, /COMPARE_JOB_KEY.*32/);
    expectRejected({ ...production, COMPARE_JOB_KEY_PREVIOUS: 'changeme-changeme-changeme-changeme' }, /COMPARE_JOB_KEY_PREVIOUS/);
    expectRejected({ ...production, DATABASE_URL: 'postgresql://superette:superette@localhost:5432/superette' }, /DATABASE_URL/);
  });

  it('eist het adres van de uitbater (LEGAL_ENTITY_ADDRESS)', () => {
    const { LEGAL_ENTITY_ADDRESS: _omit, ...withoutAddress } = production;
    expectRejected(withoutAddress, /LEGAL_ENTITY_ADDRESS/);
    expectRejected({ ...production, LEGAL_ENTITY_ADDRESS: '' }, /LEGAL_ENTITY_ADDRESS/);
    expectRejected({ ...production, LEGAL_ENTITY_ADDRESS: 'TODO adres invullen' }, /LEGAL_ENTITY_ADDRESS/);
  });

  it('weigert de dev-deurscanner en http-URL\'s van providers', () => {
    expectRejected({ ...production, NEXT_PUBLIC_DEV_DEVICE_KEY: 'dev-scanner-antwerpen-zuid-vervang-in-productie' }, /NEXT_PUBLIC_DEV_DEVICE_KEY/);
    expectRejected({ ...production, NEXT_PUBLIC_ENABLE_DEV_SCANNER: 'true' }, /NEXT_PUBLIC_DEV_DEVICE_KEY/);
    expect(validateEnv({ ...production, NEXT_PUBLIC_ENABLE_DEV_SCANNER: 'false', NEXT_PUBLIC_DEV_DEVICE_KEY: '' }).NODE_ENV).toBe('production');
    expectRejected({ ...production, EMAIL_PROVIDER: 'http', EMAIL_HTTP_URL: 'http://mail.example/send', EMAIL_API_KEY: 'k', EMAIL_FROM: 'a@b.be' }, /EMAIL_HTTP_URL.*https/);
    expectRejected({ ...production, ERROR_REPORTING_DSN: 'http://key@host.example/42' }, /ERROR_REPORTING_DSN.*https/);
  });

  it('boetiek uit (standaard): geen gate-sleutels, Mollie of MQTT nodig; APP_URL niet gebruikt', () => {
    const env = validateEnv(production);
    expect(env.BOUTIQUE_ENABLED).toBe(false);
    expect(env.GATE_SIGNING_PRIVATE_JWK).toBeUndefined();
    expect(validateEnv({ ...production, APP_URL: 'http://localhost:3000' }).NODE_ENV).toBe('production');
  });

  it('boetiek aan: eist gate-sleutels, een live Mollie-sleutel en mqtts', () => {
    expect(validateEnv(productionBoutique).BOUTIQUE_ENABLED).toBe(true);
    const { GATE_SIGNING_PRIVATE_JWK: _p, ...withoutGateKey } = productionBoutique;
    expectRejected(withoutGateKey, /GATE_SIGNING_PRIVATE_JWK/);
    expectRejected({ ...productionBoutique, MOLLIE_API_KEY: 'test_dummy' }, /MOLLIE_API_KEY.*test/);
    expectRejected({ ...productionBoutique, MQTT_ENABLED: 'true', MQTT_URL: 'mqtt://broker.example:1883' }, /MQTT_URL/);
    expect(validateEnv({ ...productionBoutique, MQTT_ENABLED: 'true', MQTT_URL: 'mqtts://broker.example:8883' }).MQTT_URL).toBe('mqtts://broker.example:8883');
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
  it('boetiek aan zonder gate-sleutels wordt ook lokaal geweigerd', () => {
    expectRejected({ DATABASE_URL: base['DATABASE_URL']!, JWT_SECRET: base['JWT_SECRET']!, BOUTIQUE_ENABLED: 'true' }, /GATE_SIGNING_PRIVATE_JWK/);
  });

  it('behandelt lege waarden uit .env (KEY="") als niet gezet', () => {
    const env = validateEnv({ ...base, COMPARE_JOB_KEY: '', COMPARE_JOB_KEY_PREVIOUS: '', EMAIL_FROM: '', MOLLIE_API_KEY: '' });
    expect(env.COMPARE_JOB_KEY).toBeUndefined();
    expect(env.MOLLIE_API_KEY).toBeUndefined();
  });

  it('laat lokale http-origins en demogegevens toe', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'development', COMPARE_ALLOW_DEMO: 'true' });
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.COMPARE_ALLOW_DEMO).toBe(true);
    expect(env.TRUST_PROXY).toBe(false);
  });
});
