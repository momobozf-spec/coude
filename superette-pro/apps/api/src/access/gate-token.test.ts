import { generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { signGateToken, verifyGateToken, type SigningKey } from './gate-token';

let privateKey: SigningKey;
let publicKey: SigningKey;
let otherPublicKey: SigningKey;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;

  const other = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  otherPublicKey = other.publicKey;
});

const baseParams = (overrides: Partial<Parameters<typeof signGateToken>[0]> = {}) => {
  const now = new Date('2026-07-08T09:00:00.000Z');
  return {
    tokenId: 'tok_abc123',
    userId: 'usr_jamila',
    storeId: 'store_antwerpen',
    nonce: 'n_0123456789abcdef',
    rotationSeq: 3,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    ...overrides,
  };
};

describe('signGateToken', () => {
  it('produceert een compacte JWS met drie segmenten', async () => {
    const jws = await signGateToken(baseParams(), privateKey);
    expect(jws.split('.')).toHaveLength(3);
  });

  it('weigert een vervaltijd die niet na de uitgiftetijd ligt', async () => {
    const now = new Date('2026-07-08T09:00:00.000Z');
    await expect(signGateToken(baseParams({ issuedAt: now, expiresAt: now }), privateKey)).rejects.toThrow(RangeError);
  });

  it('lekt geen persoonsgegevens in de payload', async () => {
    const jws = await signGateToken(baseParams(), privateKey);
    const payload = JSON.parse(Buffer.from(jws.split('.')[1]!, 'base64url').toString('utf8'));

    // Alleen deze claims mogen erin zitten. Geen naam, e-mail of telefoon.
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'jti', 'nonce', 'seq', 'sid', 'sub']);
  });
});

describe('verifyGateToken', () => {
  it('accepteert een verse, correct ondertekende token', async () => {
    const params = baseParams({ issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
    const jws = await signGateToken(params, privateKey);

    const result = await verifyGateToken(jws, publicKey);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('onbereikbaar');
    expect(result.claims.jti).toBe('tok_abc123');
    expect(result.claims.sub).toBe('usr_jamila');
    expect(result.claims.sid).toBe('store_antwerpen');
    expect(result.claims.seq).toBe(3);
  });

  it('wijst een token af die met een andere sleutel is ondertekend', async () => {
    const params = baseParams({ issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
    const jws = await signGateToken(params, privateKey);

    // Dit is het scenario "aanvaller vervalst een sleutel": de handtekening
    // klopt niet met de public key op de scanner.
    const result = await verifyGateToken(jws, otherPublicKey);

    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('onderscheidt een verlopen token van een ongeldige', async () => {
    // Ruim buiten de klokspeling van 5 seconden.
    const issuedAt = new Date(Date.now() - 300_000);
    const expiresAt = new Date(Date.now() - 240_000);
    const jws = await signGateToken(baseParams({ issuedAt, expiresAt }), privateKey);

    const result = await verifyGateToken(jws, publicKey);

    expect(result).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('accepteert een token die net binnen de klokspeling verlopen is', async () => {
    // Telefoon en scanner lopen zelden exact gelijk. 2 seconden over de datum
    // mag geen klant buiten laten staan.
    const issuedAt = new Date(Date.now() - 62_000);
    const expiresAt = new Date(Date.now() - 2_000);
    const jws = await signGateToken(baseParams({ issuedAt, expiresAt }), privateKey);

    const result = await verifyGateToken(jws, publicKey);

    expect(result.ok).toBe(true);
  });

  it('wijst een geknoeide payload af', async () => {
    const params = baseParams({ issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
    const jws = await signGateToken(params, privateKey);

    // Aanvaller wisselt de winkel-id om, in de hoop een andere deur te openen.
    const [header, payload, signature] = jws.split('.');
    const tampered = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'));
    tampered.sid = 'store_gent';
    const forgedPayload = Buffer.from(JSON.stringify(tampered)).toString('base64url');

    const result = await verifyGateToken(`${header}.${forgedPayload}.${signature}`, publicKey);

    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('weigert een "alg: none" token', async () => {
    // De klassieke JWT-aanval: laat de verificateur het algoritme uit de token
    // lezen. Wij pinnen EdDSA, dus dit mag nooit slagen.
    const unsecured = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(
      JSON.stringify({ jti: 'x', sub: 'y', sid: 'z', nonce: 'n', seq: 0, iat: 1, exp: 9999999999 }),
    ).toString('base64url')}.`;

    const result = await verifyGateToken(unsecured, publicKey);

    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('wijst een correct ondertekende token met onvolledige claims af', async () => {
    // Ondertekend met onze eigen sleutel, maar `nonce` en `seq` ontbreken.
    // Kan gebeuren bij een oude tokenversie na een deploy.
    const jws = await new SignJWT({ sid: 'store_antwerpen' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setJti('tok_x')
      .setSubject('usr_x')
      .setIssuedAt()
      .setExpirationTime('1m')
      .sign(privateKey);

    const result = await verifyGateToken(jws, publicKey);

    expect(result).toEqual({ ok: false, reason: 'MALFORMED_CLAIMS' });
  });

  it('wijst willekeurige onzin af zonder te crashen', async () => {
    for (const junk of ['', 'niet-een-jwt', 'a.b.c', '....', '{}']) {
      const result = await verifyGateToken(junk, publicKey);
      expect(result.ok).toBe(false);
    }
  });
});
