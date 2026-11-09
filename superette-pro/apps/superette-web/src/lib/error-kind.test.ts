import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { errorKind } from './error-kind';

describe('errorKind', () => {
  it('onderscheidt offline van een onbereikbare server', () => {
    expect(errorKind(new ApiError(0, 'network'), false)).toBe('offline');
    expect(errorKind(new ApiError(0, 'network'), true)).toBe('network');
  });

  it('herkent een verlopen sessie', () => {
    expect(errorKind(new ApiError(401, 'sessionExpired'), true)).toBe('session');
  });

  it('valt terug op een algemene fout', () => {
    expect(errorKind(new ApiError(500, 'Kapot'), true)).toBe('generic');
    expect(errorKind(new Error('x'), true)).toBe('generic');
    expect(errorKind(null, true)).toBe('generic');
  });
});
