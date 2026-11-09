import { describe, expect, it } from 'vitest';
import { serviceWorkerUrl, shouldRegisterServiceWorker } from './service-worker';

const base = { nodeEnv: 'production', supported: true, protocol: 'https:', hostname: 'superette.be' };

describe('shouldRegisterServiceWorker', () => {
  it('registreert in productie op HTTPS', () => {
    expect(shouldRegisterServiceWorker(base)).toBe(true);
  });
  it('nooit in ontwikkeling of test', () => {
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: 'development' })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: 'test' })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: undefined })).toBe(false);
  });
  it('niet zonder ondersteuning of op een onveilige oorsprong', () => {
    expect(shouldRegisterServiceWorker({ ...base, supported: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, protocol: 'http:' })).toBe(false);
  });
  it('wel op localhost over http (lokale productiebuild)', () => {
    expect(shouldRegisterServiceWorker({ ...base, protocol: 'http:', hostname: 'localhost' })).toBe(true);
    expect(shouldRegisterServiceWorker({ ...base, protocol: 'http:', hostname: '127.0.0.1' })).toBe(true);
  });
});

describe('serviceWorkerUrl', () => {
  it('geeft de API-basis mee, zonder slash op het einde', () => {
    expect(serviceWorkerUrl('https://api.superette.be/api/v1/')).toBe('/sw.js?api=https%3A%2F%2Fapi.superette.be%2Fapi%2Fv1');
  });
});
