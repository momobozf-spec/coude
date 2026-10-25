import { describe, expect, it } from 'vitest';

import { formatEntityAddress, getLegalEntity } from '@/lib/legal/entity';

describe('uitbater', () => {
  it('gebruikt de BV-gegevens', () => {
    const entity = getLegalEntity({});
    expect(entity.name).toBe('Marhaba Cooperation BV');
    expect(entity.vatNumber).toBe('BE 1037.222.285');
    expect(entity.municipality).toBe('Heers');
    expect(entity.email).toBe('momobozf@gmail.com');
  });

  it('zonder env: de zetel uit het KBO-register', () => {
    const entity = getLegalEntity({});
    expect(entity.address).toBe('Sweetstraat 13, 3870 Heers');
    expect(formatEntityAddress(entity)).toBe('Sweetstraat 13, 3870 Heers');
    expect(formatEntityAddress(getLegalEntity({ LEGAL_ENTITY_ADDRESS: '  ' }))).toBe(
      'Sweetstraat 13, 3870 Heers',
    );
  });

  it('neemt adres en e-mail uit de omgeving', () => {
    const entity = getLegalEntity({
      LEGAL_ENTITY_ADDRESS: 'Voorbeeldstraat 1, 3870 Heers',
      LEGAL_CONTACT_EMAIL: 'privacy@example.be',
    });
    expect(formatEntityAddress(entity)).toBe('Voorbeeldstraat 1, 3870 Heers');
    expect(entity.email).toBe('privacy@example.be');
  });
});
