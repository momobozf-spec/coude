import { describe, expect, it } from 'vitest';

import {
  ROOM_PRESETS,
  customRoomKey,
  isCustomRoom,
  roomCompleteness,
  slotFor,
  slotsForRoom,
} from '@/lib/inspections/rooms';
import {
  MAX_PHOTO_BYTES,
  photoUploadSchema,
  storagePathFor,
  validateFile,
} from '@/lib/inspections/upload';

describe('kamerpresets', () => {
  it('heeft unieke sleutels', () => {
    const keys = ROOM_PRESETS.map((preset) => preset.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('geeft elke kamer een naam in beide talen', () => {
    for (const preset of ROOM_PRESETS) {
      expect(preset.nl.length, preset.key).toBeGreaterThan(1);
      expect(preset.fr.length, preset.key).toBeGreaterThan(1);
    }
  });

  it('bevat de meterstanden als standaardkamer', () => {
    const meters = ROOM_PRESETS.find((preset) => preset.key === 'meters');
    expect(meters?.defaultSelected).toBe(true);
  });
});

describe('customRoomKey', () => {
  it('maakt een sleutel zonder accenten of spaties', () => {
    expect(customRoomKey('Bureau à l’étage', 3)).toBe('custom:bureau_a_l_etage_3');
  });

  it('valt terug op een standaardnaam bij lege invoer', () => {
    expect(customRoomKey('!!!', 0)).toBe('custom:kamer_0');
  });

  it('is herkenbaar als eigen kamer', () => {
    expect(isCustomRoom(customRoomKey('Zolder', 1))).toBe(true);
    expect(isCustomRoom('kitchen')).toBe(false);
  });
});

describe('slotsForRoom', () => {
  it('geeft de meterchecklist voor de meterkamer', () => {
    const labels = slotsForRoom('meters').map((slot) => slot.label);
    expect(labels).toContain('meter_electricity');
    expect(labels).not.toContain('floor');
  });

  it('geeft de standaardchecklist voor een gewone kamer', () => {
    const labels = slotsForRoom('kitchen').map((slot) => slot.label);
    expect(labels).toContain('overview');
    expect(labels).toContain('damage_closeup');
  });

  it('vindt een slot op label', () => {
    expect(slotFor('floor')?.nl).toBe('Vloer');
    expect(slotFor('bestaat_niet')).toBeNull();
  });
});

describe('roomCompleteness', () => {
  it('meldt ontbrekende aanbevolen foto’s', () => {
    const result = roomCompleteness('living_room', [{ label: 'overview' }]);
    expect(result.missingRequired).toEqual(['floor', 'walls']);
    expect(result.isComplete).toBe(false);
  });

  it('is volledig zodra alle aanbevolen labels aanwezig zijn', () => {
    const result = roomCompleteness('living_room', [
      { label: 'overview' },
      { label: 'floor' },
      { label: 'walls' },
    ]);
    expect(result.missingRequired).toEqual([]);
    expect(result.isComplete).toBe(true);
  });

  it('is nooit volledig zonder foto’s', () => {
    expect(roomCompleteness('garage', []).isComplete).toBe(false);
  });
});

describe('validateFile', () => {
  function fakeFile(size: number, type: string): File {
    return { size, type, name: 'foto' } as unknown as File;
  }

  it('aanvaardt een gewone JPEG', () => {
    expect(validateFile(fakeFile(2_000_000, 'image/jpeg'))).toBeNull();
  });

  it('weigert een ontbrekend bestand', () => {
    expect(validateFile(null)).toEqual({ kind: 'NO_FILE' });
  });

  it('weigert een leeg bestand', () => {
    expect(validateFile(fakeFile(0, 'image/jpeg'))).toEqual({ kind: 'EMPTY_FILE' });
  });

  it('weigert een te groot bestand', () => {
    expect(validateFile(fakeFile(MAX_PHOTO_BYTES + 1, 'image/jpeg'))).toEqual({
      kind: 'TOO_LARGE',
      bytes: MAX_PHOTO_BYTES + 1,
    });
  });

  it('weigert een PDF', () => {
    expect(validateFile(fakeFile(1000, 'application/pdf'))).toEqual({
      kind: 'TYPE_NOT_ALLOWED',
      received: 'application/pdf',
    });
  });

  it('weigert HEIC, zodat iOS zelf naar JPEG omzet', () => {
    expect(validateFile(fakeFile(1000, 'image/heic'))).toEqual({
      kind: 'TYPE_NOT_ALLOWED',
      received: 'image/heic',
    });
  });
});

describe('storagePathFor', () => {
  const hash = 'a'.repeat(64);

  it('begint met het user-id, want daar leidt het storagebeleid de eigenaar uit af', () => {
    const path = storagePathFor('user-1', 'insp-1', hash, 'image/jpeg');
    expect(path.startsWith('user-1/')).toBe(true);
    expect(path).toBe(`user-1/insp-1/${hash}.jpg`);
  });

  it('kiest de juiste extensie per type', () => {
    expect(storagePathFor('u', 'i', hash, 'image/png').endsWith('.png')).toBe(true);
    expect(storagePathFor('u', 'i', hash, 'image/webp').endsWith('.webp')).toBe(true);
  });
});

describe('photoUploadSchema', () => {
  it('aanvaardt kamer en label', () => {
    const result = photoUploadSchema.safeParse({
      roomKey: 'kitchen',
      label: 'floor',
      note: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeNull();
  });

  it('weigert een lege kamersleutel', () => {
    expect(
      photoUploadSchema.safeParse({ roomKey: '', label: 'floor' }).success,
    ).toBe(false);
  });

  it('begrenst de lengte van een notitie', () => {
    expect(
      photoUploadSchema.safeParse({
        roomKey: 'kitchen',
        label: 'floor',
        note: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });
});
