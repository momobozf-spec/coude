import { describe, expect, it } from 'vitest';

import { safeNextPath } from '@/lib/auth/redirect';

describe('safeNextPath', () => {
  it('laat de herstelpagina toe', () => {
    expect(safeNextPath('/nl/reset-password', 'nl')).toBe('/nl/reset-password');
  });

  it.each([
    'https://evil.example/nl/reset-password',
    '//evil.example',
    '/\\evil.example',
    '/nl/reset-password?x=1',
    '/fr/reset-password',
    '/nl/../admin',
    'javascript:alert(1)',
  ])('weigert %s', (value) => {
    expect(safeNextPath(value, 'nl')).toBe('/nl/dashboard');
  });

  it('valt terug op het overzicht', () => {
    expect(safeNextPath(null, 'fr')).toBe('/fr/dashboard');
  });
});
