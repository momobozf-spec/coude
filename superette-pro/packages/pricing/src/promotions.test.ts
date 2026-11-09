import { describe, expect, it } from 'vitest';
import {
  assertPromotionRule,
  bestEffectiveUnitPrice,
  describePromotion,
  effectivePrice,
  promotionMinimumQuantity,
  type PromotionRule,
} from './promotions';

describe('effectivePrice — zonder promotie', () => {
  it('rekent de gewone prijs', () => {
    expect(effectivePrice(179, { kind: 'NONE' }, 3)).toMatchObject({
      totalCents: 537,
      effectiveUnitCents: 179,
      savingsCents: 0,
      conditionMet: true,
      minimumQuantity: 1,
      note: null,
    });
  });
});

describe('effectivePrice — 1+1 gratis', () => {
  const rule: PromotionRule = { kind: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 };

  it('geldt niet voor één stuk, en zegt dat', () => {
    expect(effectivePrice(200, rule, 1)).toMatchObject({
      totalCents: 200,
      effectiveUnitCents: 200,
      conditionMet: false,
      minimumQuantity: 2,
      note: 'Geldt vanaf 2 stuks',
    });
  });

  it('halveert de stukprijs bij twee', () => {
    expect(effectivePrice(200, rule, 2)).toMatchObject({
      totalCents: 200,
      effectiveUnitCents: 100,
      savingsCents: 200,
      conditionMet: true,
      note: null,
    });
  });

  it('rekent drie stuks als één gratis en twee betaald', () => {
    expect(effectivePrice(200, rule, 3)).toMatchObject({ totalCents: 400, effectiveUnitCents: 133 });
  });

  it('ondersteunt 2+1 gratis', () => {
    const twoPlusOne: PromotionRule = { kind: 'BUY_X_GET_Y_FREE', buy: 2, free: 1 };
    expect(effectivePrice(150, twoPlusOne, 3)).toMatchObject({ totalCents: 300, effectiveUnitCents: 100 });
    expect(effectivePrice(150, twoPlusOne, 2)).toMatchObject({ totalCents: 300, conditionMet: false });
    expect(effectivePrice(150, twoPlusOne, 6)).toMatchObject({ totalCents: 600 });
  });
});

describe('effectivePrice — 2 voor €5', () => {
  const rule: PromotionRule = { kind: 'MULTIBUY', quantity: 2, totalCents: 500 };

  it('past de bundelprijs toe per volledige bundel', () => {
    expect(effectivePrice(299, rule, 2)).toMatchObject({ totalCents: 500, effectiveUnitCents: 250, savingsCents: 98 });
    expect(effectivePrice(299, rule, 3)).toMatchObject({ totalCents: 799, effectiveUnitCents: 266 });
    expect(effectivePrice(299, rule, 4)).toMatchObject({ totalCents: 1000 });
  });

  it('stelt de bundelprijs nooit voor als prijs voor één stuk', () => {
    expect(effectivePrice(299, rule, 1)).toMatchObject({
      totalCents: 299,
      effectiveUnitCents: 299,
      conditionMet: false,
      note: 'Geldt vanaf 2 stuks',
    });
  });

  it('negeert een bundel die duurder is dan de gewone prijs', () => {
    // Fles kost €2,40; "2 voor €5" is dan geen promotie.
    expect(effectivePrice(240, rule, 2)).toMatchObject({ totalCents: 480, conditionMet: false });
  });
});

describe('effectivePrice — percentage', () => {
  it('past de korting per stuk toe en rondt op de cent', () => {
    expect(effectivePrice(1000, { kind: 'PERCENTAGE', percent: 30 }, 1)).toMatchObject({ totalCents: 700, savingsCents: 300 });
    expect(effectivePrice(1795, { kind: 'PERCENTAGE', percent: 15 }, 2)).toMatchObject({ totalCents: 3052 });
  });
});

describe('effectivePrice — vaste promoprijs', () => {
  it('gebruikt de laagste van promo- en gewone prijs', () => {
    expect(effectivePrice(199, { kind: 'FIXED_PRICE', priceCents: 149 }, 2)).toMatchObject({ totalCents: 298, savingsCents: 100 });
    expect(effectivePrice(199, { kind: 'FIXED_PRICE', priceCents: 249 }, 1)).toMatchObject({ totalCents: 199, conditionMet: false });
  });
});

describe('effectivePrice — staffelkorting (minimumaantal)', () => {
  const rule: PromotionRule = { kind: 'VOLUME_DISCOUNT', minimumQuantity: 3, unitPriceCents: 150 };

  it('geeft de lagere stukprijs pas vanaf het minimumaantal', () => {
    expect(effectivePrice(199, rule, 2)).toMatchObject({ totalCents: 398, conditionMet: false, minimumQuantity: 3 });
    expect(effectivePrice(199, rule, 3)).toMatchObject({ totalCents: 450, conditionMet: true });
    expect(effectivePrice(199, rule, 5)).toMatchObject({ totalCents: 750 });
  });
});

describe('effectivePrice — 2de aan halve prijs', () => {
  const rule: PromotionRule = { kind: 'NTH_AT_DISCOUNT', nth: 2, percent: 50 };

  it('geeft korting op elk tweede stuk', () => {
    expect(effectivePrice(400, rule, 1)).toMatchObject({ totalCents: 400, conditionMet: false });
    expect(effectivePrice(400, rule, 2)).toMatchObject({ totalCents: 600, effectiveUnitCents: 300 });
    expect(effectivePrice(400, rule, 3)).toMatchObject({ totalCents: 1000 });
    expect(effectivePrice(400, rule, 4)).toMatchObject({ totalCents: 1200 });
  });
});

describe('bestEffectiveUnitPrice', () => {
  it('geeft de laagste haalbare stukprijs en het aantal daarvoor', () => {
    expect(bestEffectiveUnitPrice(200, { kind: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 })).toEqual({
      unitCents: 100,
      atQuantity: 2,
      conditional: true,
    });
    expect(bestEffectiveUnitPrice(1000, { kind: 'PERCENTAGE', percent: 20 })).toEqual({
      unitCents: 800,
      atQuantity: 1,
      conditional: false,
    });
    expect(bestEffectiveUnitPrice(179, { kind: 'NONE' })).toEqual({ unitCents: 179, atQuantity: 1, conditional: false });
  });
});

describe('promotionMinimumQuantity', () => {
  it('kent het minimum per regel', () => {
    expect(promotionMinimumQuantity({ kind: 'NONE' })).toBe(1);
    expect(promotionMinimumQuantity({ kind: 'BUY_X_GET_Y_FREE', buy: 2, free: 1 })).toBe(3);
    expect(promotionMinimumQuantity({ kind: 'MULTIBUY', quantity: 3, totalCents: 1000 })).toBe(3);
    expect(promotionMinimumQuantity({ kind: 'VOLUME_DISCOUNT', minimumQuantity: 6, unitPriceCents: 100 })).toBe(6);
  });
});

describe('assertPromotionRule', () => {
  it('weigert onzinnige feeddata', () => {
    expect(() => assertPromotionRule({ kind: 'PERCENTAGE', percent: 0 })).toThrow(RangeError);
    expect(() => assertPromotionRule({ kind: 'PERCENTAGE', percent: 150 })).toThrow(RangeError);
    expect(() => assertPromotionRule({ kind: 'MULTIBUY', quantity: 1, totalCents: 100 })).toThrow(RangeError);
    expect(() => assertPromotionRule({ kind: 'BUY_X_GET_Y_FREE', buy: 0, free: 1 })).toThrow(RangeError);
    expect(() => assertPromotionRule({ kind: 'FIXED_PRICE', priceCents: 1.5 })).toThrow(RangeError);
    expect(() => assertPromotionRule({ kind: 'NTH_AT_DISCOUNT', nth: 1, percent: 50 })).toThrow(RangeError);
  });

  it('weigert een ongeldig aantal', () => {
    expect(() => effectivePrice(100, { kind: 'NONE' }, 0)).toThrow(RangeError);
    expect(() => effectivePrice(100, { kind: 'NONE' }, 1.5)).toThrow(RangeError);
  });
});

describe('describePromotion', () => {
  it('maakt een kort Nederlands label', () => {
    expect(describePromotion({ kind: 'NONE' })).toBeNull();
    expect(describePromotion({ kind: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 })).toBe('1+1 gratis');
    expect(describePromotion({ kind: 'MULTIBUY', quantity: 2, totalCents: 500 })).toBe('2 voor €5,00');
    expect(describePromotion({ kind: 'PERCENTAGE', percent: 30 })).toBe('-30%');
    expect(describePromotion({ kind: 'PERCENTAGE', percent: 12.5 })).toBe('-12,5%');
    expect(describePromotion({ kind: 'NTH_AT_DISCOUNT', nth: 2, percent: 50 })).toBe('2de aan -50%');
    expect(describePromotion({ kind: 'VOLUME_DISCOUNT', minimumQuantity: 3, unitPriceCents: 150 })).toBe(
      'Vanaf 3 stuks: €1,50 per stuk',
    );
  });
});
