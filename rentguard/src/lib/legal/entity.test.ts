import { describe, expect, it } from 'vitest';

import { formatEntityAddress, getLegalEntity } from '@/lib/legal/entity';

describe('uitbater', () => {
  it('gebruikt de BV-gegevens', () => {
    const entity = getLegalEntity({});
    expect(entity.name).toBe('Marhaba Data & AI Agent BV');
    expect(entity.vatNumber).toBe('BE 1003.552.102');
    expect(entity.municipality).toBe('Zaventem');
    expect(entity.email).toBe('momobozf@gmail.com');
  });

  it('verzint geen adres: zonder env enkel de gemeente', () => {
    const entity = getLegalEntity({});
    expect(entity.address).toBeNull();
    expect(formatEntityAddress(entity)).toBe('Zaventem');
  });

  it('neemt adres en e-mail uit de omgeving', () => {
    const entity = getLegalEntity({
      LEGAL_ENTITY_ADDRESS: 'Voorbeeldstraat 1, 1930 Zaventem',
      LEGAL_CONTACT_EMAIL: 'privacy@example.be',
    });
    expect(formatEntityAddress(entity)).toBe('Voorbeeldstraat 1, 1930 Zaventem');
    expect(entity.email).toBe('privacy@example.be');
  });
});
