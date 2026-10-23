import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from '@/proxy';

describe('proxy', () => {
  it('stuurt de auth-callback niet door naar een taalprefix', async () => {
    const res = await proxy(new NextRequest('http://localhost/auth/callback?code=abc'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('stuurt de herstel-bevestiging niet door', async () => {
    const res = await proxy(
      new NextRequest('http://localhost/auth/confirm?token_hash=x&type=recovery'),
    );
    expect(res.headers.get('location')).toBeNull();
  });

  it('zet pagina’s zonder taal onder een taalprefix', async () => {
    const res = await proxy(
      new NextRequest('http://localhost/login', { headers: { 'accept-language': 'nl-BE' } }),
    );
    expect(res.headers.get('location')).toBe('http://localhost/nl/login');
  });
});
