import { describe, expect, it } from 'vitest';
import { baseUnitOf, formatBaseQuantity, parseQuantityLabel, parseUnitToken, perUnitLabel, toBaseQuantity } from './units';

describe('toBaseQuantity', () => {
  it('zet gewicht om naar gram', () => {
    expect(toBaseQuantity(500, 'G')).toEqual({ amount: 500, unit: 'KG' });
    expect(toBaseQuantity(1, 'KG')).toEqual({ amount: 1000, unit: 'KG' });
    expect(toBaseQuantity(0.5, 'KG')).toEqual({ amount: 500, unit: 'KG' });
    expect(toBaseQuantity(2.5, 'KG')).toEqual({ amount: 2500, unit: 'KG' });
  });

  it('zet volume om naar milliliter', () => {
    expect(toBaseQuantity(1.5, 'L')).toEqual({ amount: 1500, unit: 'L' });
    expect(toBaseQuantity(33, 'CL')).toEqual({ amount: 330, unit: 'L' });
    expect(toBaseQuantity(750, 'ML')).toEqual({ amount: 750, unit: 'L' });
    expect(toBaseQuantity(0.33, 'L')).toEqual({ amount: 330, unit: 'L' });
  });

  it('laat stuks ongemoeid', () => {
    expect(toBaseQuantity(6, 'PIECE')).toEqual({ amount: 6, unit: 'PIECE' });
  });

  it('geeft null bij onbruikbare hoeveelheden in plaats van te raden', () => {
    expect(toBaseQuantity(0, 'G')).toBeNull();
    expect(toBaseQuantity(-1, 'L')).toBeNull();
    expect(toBaseQuantity(Number.NaN, 'KG')).toBeNull();
    expect(toBaseQuantity(0.0001, 'G')).toBeNull(); // rondt naar 0
  });
});

describe('baseUnitOf', () => {
  it('kent elke verpakkingseenheid aan een familie toe', () => {
    expect(baseUnitOf('G')).toBe('KG');
    expect(baseUnitOf('CL')).toBe('L');
    expect(baseUnitOf('PIECE')).toBe('PIECE');
  });
});

describe('parseUnitToken', () => {
  it('herkent de gangbare schrijfwijzen in nl/fr/en', () => {
    expect(parseUnitToken('gr')).toBe('G');
    expect(parseUnitToken('Kilo')).toBe('KG');
    expect(parseUnitToken('cl')).toBe('CL');
    expect(parseUnitToken('litre')).toBe('L');
    expect(parseUnitToken('stuks')).toBe('PIECE');
    expect(parseUnitToken('pièces')).toBe('PIECE');
    expect(parseUnitToken('bananen')).toBeNull();
  });
});

describe('parseQuantityLabel', () => {
  it('leest enkelvoudige hoeveelheden uit etiketten en productnamen', () => {
    expect(parseQuantityLabel('Coca-Cola Zero 1,5 L')).toEqual({ quantity: 1.5, unit: 'L', packCount: 1 });
    expect(parseQuantityLabel('Kipfilet 500 g')).toEqual({ quantity: 500, unit: 'G', packCount: 1 });
    expect(parseQuantityLabel('750ml')).toEqual({ quantity: 750, unit: 'ML', packCount: 1 });
    expect(parseQuantityLabel('Eieren 12 stuks')).toEqual({ quantity: 12, unit: 'PIECE', packCount: 1 });
    expect(parseQuantityLabel('Halfvolle melk 1 l')).toEqual({ quantity: 1, unit: 'L', packCount: 1 });
  });

  it('leest multipacks', () => {
    expect(parseQuantityLabel('Jupiler 6 x 33 cl')).toEqual({ quantity: 33, unit: 'CL', packCount: 6 });
    expect(parseQuantityLabel('Yoghurt 4x100g')).toEqual({ quantity: 100, unit: 'G', packCount: 4 });
    expect(parseQuantityLabel('Spa 2 × 1,5 l')).toEqual({ quantity: 1.5, unit: 'L', packCount: 2 });
  });

  it('geeft null als er geen hoeveelheid in staat', () => {
    expect(parseQuantityLabel('Toiletpapier')).toBeNull();
    expect(parseQuantityLabel('')).toBeNull();
  });
});

describe('formatBaseQuantity / perUnitLabel', () => {
  it('toont de hoeveelheid leesbaar', () => {
    expect(formatBaseQuantity({ amount: 1500, unit: 'L' })).toBe('1,5 l');
    expect(formatBaseQuantity({ amount: 330, unit: 'L' })).toBe('330 ml');
    expect(formatBaseQuantity({ amount: 1000, unit: 'KG' })).toBe('1 kg');
    expect(formatBaseQuantity({ amount: 500, unit: 'KG' })).toBe('500 g');
    expect(formatBaseQuantity({ amount: 6, unit: 'PIECE' })).toBe('6 stuks');
    expect(formatBaseQuantity({ amount: 1, unit: 'PIECE' })).toBe('1 stuk');
    expect(formatBaseQuantity({ amount: 2, unit: 'PIECE' }, 'fr')).toBe('2 pièces');
  });

  it('geeft het per-label', () => {
    expect(perUnitLabel('KG')).toBe('kg');
    expect(perUnitLabel('L')).toBe('l');
    expect(perUnitLabel('PIECE')).toBe('stuk');
    expect(perUnitLabel('PIECE', 'fr')).toBe('pièce');
  });
});
