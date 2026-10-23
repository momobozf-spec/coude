import { describe, expect, it } from 'vitest';

import {
  buildEvidenceRecord,
  capturedAtFromExif,
  pickExifFields,
  sha256Hex,
  shortHash,
  verifyIntegrity,
} from '@/lib/evidence/hash';

describe('sha256Hex', () => {
  it('geeft de bekende hash van een lege invoer', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('geeft altijd 64 hexadecimale tekens in kleine letters', () => {
    const hash = sha256Hex(new Uint8Array([1, 2, 3]));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('geeft een andere hash bij één gewijzigde byte', () => {
    expect(sha256Hex(new Uint8Array([1, 2, 3]))).not.toBe(
      sha256Hex(new Uint8Array([1, 2, 4])),
    );
  });
});

describe('verifyIntegrity', () => {
  const bytes = new Uint8Array([9, 8, 7]);
  const hash = sha256Hex(bytes);

  it('herkent ongewijzigde bytes', () => {
    expect(verifyIntegrity(bytes, hash)).toBe(true);
  });

  it('herkent gewijzigde bytes', () => {
    expect(verifyIntegrity(new Uint8Array([9, 8, 6]), hash)).toBe(false);
  });

  it('is ongevoelig voor hoofdletters in de opgeslagen hash', () => {
    expect(verifyIntegrity(bytes, hash.toUpperCase())).toBe(true);
  });
});

describe('pickExifFields', () => {
  it('behoudt alleen de velden die wij bewaren', () => {
    const picked = pickExifFields({
      Make: 'Fairphone',
      Model: 'FP5',
      DateTimeOriginal: '2026-03-01T10:00:00.000Z',
      UserComment: 'iets persoonlijks',
      LensSerialNumber: 'XYZ',
    });

    expect(picked).toEqual({
      Make: 'Fairphone',
      Model: 'FP5',
      DateTimeOriginal: '2026-03-01T10:00:00.000Z',
    });
  });

  it('zet datums om naar ISO-tekst', () => {
    const picked = pickExifFields({
      CreateDate: new Date('2026-03-01T10:00:00.000Z'),
    });
    expect(picked?.CreateDate).toBe('2026-03-01T10:00:00.000Z');
  });

  it('geeft null wanneer er niets bruikbaars is', () => {
    expect(pickExifFields({ UserComment: 'x' })).toBeNull();
    expect(pickExifFields(null)).toBeNull();
    expect(pickExifFields(undefined)).toBeNull();
  });
});

describe('capturedAtFromExif', () => {
  it('geeft voorrang aan DateTimeOriginal', () => {
    const at = capturedAtFromExif({
      DateTimeOriginal: '2026-03-01T10:00:00.000Z',
      CreateDate: '2020-01-01T00:00:00.000Z',
    });
    expect(at?.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('valt terug op CreateDate', () => {
    const at = capturedAtFromExif({ CreateDate: '2026-03-01T10:00:00.000Z' });
    expect(at?.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('geeft null bij een onleesbare datum', () => {
    expect(capturedAtFromExif({ DateTimeOriginal: 'geen datum' })).toBeNull();
    expect(capturedAtFromExif(null)).toBeNull();
  });
});

describe('buildEvidenceRecord', () => {
  it('legt hash, grootte en servertijd vast', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const before = Date.now();
    const record = buildEvidenceRecord(bytes);

    expect(record.sha256).toBe(sha256Hex(bytes));
    expect(record.byteSize).toBe(4);
    expect(record.registeredAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('neemt de opnamedatum uit EXIF over als losse waarde', () => {
    const record = buildEvidenceRecord(new Uint8Array([1]), {
      DateTimeOriginal: '2026-03-01T10:00:00.000Z',
      Make: 'Fairphone',
    });

    expect(record.capturedAt?.toISOString()).toBe('2026-03-01T10:00:00.000Z');
    expect(record.exif).toEqual({
      DateTimeOriginal: '2026-03-01T10:00:00.000Z',
      Make: 'Fairphone',
    });
  });

  it('werkt zonder EXIF', () => {
    const record = buildEvidenceRecord(new Uint8Array([1]));
    expect(record.capturedAt).toBeNull();
    expect(record.exif).toBeNull();
  });
});

describe('shortHash', () => {
  it('kort af tot begin en einde', () => {
    expect(shortHash('a'.repeat(56) + 'b'.repeat(8))).toBe(
      'aaaaaaaa…bbbbbbbb',
    );
  });
});
