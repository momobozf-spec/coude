import { applyBps, assertCents, type Bps, type Cents } from './money.js';

/**
 * Herkomst van de boeking bepaalt het commissietarief:
 * - platform: klant kwam via Ritna (app, zoekpagina, hotelpartner)
 * - operator_channel: klant kwam via eigen link/QR van het taxibedrijf
 */
export type BookingSource = 'platform' | 'operator_channel';

export interface CommissionAgreement {
  platformSourceBps: Bps; // bv. 1200 = 12%
  operatorChannelBps: Bps; // bv. 500 = 5%
}

export interface Settlement {
  /** Wat de klant betaalt (ritprijs + eventuele annulatie/no-show kost). */
  customerCharge: Cents;
  /** Commissie Ritna (excl. BTW op commissie). */
  platformCommission: Cents;
  /** BTW op de commissie, gefactureerd door Ritna aan de vervoerder. */
  commissionVat: Cents;
  /** Wat naar de vervoerder gaat. */
  operatorPayout: Cents;
  commissionBps: Bps;
}

export function commissionBpsFor(source: BookingSource, agreement: CommissionAgreement): Bps {
  return source === 'platform' ? agreement.platformSourceBps : agreement.operatorChannelBps;
}

/**
 * Verdeling van een aangerekend bedrag. Commissie + BTW op commissie wordt
 * ingehouden op de uitbetaling. BTW-tarieven komen uit configuratie en moeten
 * door de boekhouder bevestigd worden.
 */
export function settle(
  customerCharge: Cents,
  source: BookingSource,
  agreement: CommissionAgreement,
  commissionVatBps: Bps,
): Settlement {
  assertCents(customerCharge, 'customerCharge');
  if (customerCharge < 0) throw new Error('negatief bedrag');
  const commissionBps = commissionBpsFor(source, agreement);
  const platformCommission = applyBps(customerCharge, commissionBps);
  const commissionVat = applyBps(platformCommission, commissionVatBps);
  const operatorPayout = customerCharge - platformCommission - commissionVat;
  if (operatorPayout < 0) throw new Error('commissie groter dan ritbedrag');
  return { customerCharge, platformCommission, commissionVat, operatorPayout, commissionBps };
}
