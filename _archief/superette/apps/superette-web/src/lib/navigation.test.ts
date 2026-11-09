import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './navigation';

describe('safeReturnPath', () => {
  it('laat alleen interne paden toe', () => {
    expect(safeReturnPath('/lijsten/abc?x=1')).toBe('/lijsten/abc?x=1');
    expect(safeReturnPath('https://kwaad.example', '/profiel')).toBe('/profiel');
    expect(safeReturnPath('//kwaad.example', '/profiel')).toBe('/profiel');
    expect(safeReturnPath(null, '/profiel')).toBe('/profiel');
    expect(safeReturnPath('')).toBe('/');
  });
});
