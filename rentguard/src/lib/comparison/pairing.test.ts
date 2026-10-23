import { describe, expect, it } from 'vitest';

import { monthsOccupied, pairPhotos } from '@/lib/comparison/pairing';
import type { InspectionPhoto } from '@/lib/supabase/types';

let counter = 0;

function photo(
  room: string,
  label: string,
  uploadedAt: string,
  id?: string,
): InspectionPhoto {
  counter += 1;
  return {
    id: id ?? `photo-${counter}`,
    inspection_id: 'insp',
    room_id: null,
    room,
    label,
    storage_path: `path/${counter}`,
    sha256: 'a'.repeat(64),
    byte_size: 100,
    content_type: 'image/jpeg',
    exif: null,
    captured_at: null,
    uploaded_at: uploadedAt,
    note: null,
    created_at: uploadedAt,
  };
}

describe('pairPhotos', () => {
  it('koppelt op kamer en label', () => {
    const result = pairPhotos(
      [photo('kitchen', 'floor', '2025-01-01T10:00:00Z')],
      [photo('kitchen', 'floor', '2026-01-01T10:00:00Z')],
    );

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].room).toBe('kitchen');
    expect(result.pairs[0].label).toBe('floor');
    expect(result.unmatchedCheckIn).toEqual([]);
    expect(result.unmatchedCheckOut).toEqual([]);
  });

  it('koppelt meerdere foto’s met hetzelfde label op volgorde van upload', () => {
    const result = pairPhotos(
      [
        photo('living_room', 'walls', '2025-01-01T11:00:00Z', 'in-2'),
        photo('living_room', 'walls', '2025-01-01T10:00:00Z', 'in-1'),
      ],
      [
        photo('living_room', 'walls', '2026-01-01T10:00:00Z', 'out-1'),
        photo('living_room', 'walls', '2026-01-01T11:00:00Z', 'out-2'),
      ],
    );

    expect(result.pairs.map((pair) => [pair.checkIn.id, pair.checkOut.id])).toEqual([
      ['in-1', 'out-1'],
      ['in-2', 'out-2'],
    ]);
  });

  it('koppelt niets tussen verschillende kamers', () => {
    const result = pairPhotos(
      [photo('kitchen', 'floor', '2025-01-01T10:00:00Z')],
      [photo('bathroom', 'floor', '2026-01-01T10:00:00Z')],
    );

    expect(result.pairs).toEqual([]);
    expect(result.unmatchedCheckIn).toHaveLength(1);
    expect(result.unmatchedCheckOut).toHaveLength(1);
  });

  it('meldt een ontbrekende vertrekfoto in plaats van ze te laten verdwijnen', () => {
    const result = pairPhotos(
      [
        photo('kitchen', 'floor', '2025-01-01T10:00:00Z', 'in-1'),
        photo('kitchen', 'floor', '2025-01-01T11:00:00Z', 'in-2'),
      ],
      [photo('kitchen', 'floor', '2026-01-01T10:00:00Z', 'out-1')],
    );

    expect(result.pairs).toHaveLength(1);
    expect(result.unmatchedCheckIn.map((p) => p.id)).toEqual(['in-2']);
  });

  it('meldt een extra vertrekfoto zonder tegenhanger', () => {
    const result = pairPhotos(
      [photo('kitchen', 'floor', '2025-01-01T10:00:00Z')],
      [
        photo('kitchen', 'floor', '2026-01-01T10:00:00Z', 'out-1'),
        photo('kitchen', 'damage_closeup', '2026-01-01T11:00:00Z', 'out-2'),
      ],
    );

    expect(result.pairs).toHaveLength(1);
    expect(result.unmatchedCheckOut.map((p) => p.id)).toEqual(['out-2']);
  });

  it('geeft stabiele, unieke sleutels', () => {
    const result = pairPhotos(
      [
        photo('kitchen', 'floor', '2025-01-01T10:00:00Z'),
        photo('kitchen', 'floor', '2025-01-01T11:00:00Z'),
      ],
      [
        photo('kitchen', 'floor', '2026-01-01T10:00:00Z'),
        photo('kitchen', 'floor', '2026-01-01T11:00:00Z'),
      ],
    );

    const keys = result.pairs.map((pair) => pair.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('monthsOccupied', () => {
  it('telt hele maanden', () => {
    expect(monthsOccupied('2024-01-15', '2026-03-15')).toBe(26);
  });

  it('telt een niet-volle maand niet mee', () => {
    expect(monthsOccupied('2024-01-15', '2024-02-14')).toBe(0);
  });

  it('geeft null bij ontbrekende data', () => {
    expect(monthsOccupied(null, '2026-03-15')).toBeNull();
    expect(monthsOccupied('2024-01-15', null)).toBeNull();
  });

  it('geeft null wanneer het vertrek vóór de aanvang ligt', () => {
    expect(monthsOccupied('2026-03-15', '2024-01-15')).toBeNull();
  });
});
