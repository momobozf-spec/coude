/**
 * Ritstatus-machine. Eén bron van waarheid voor welke overgang door wie mag.
 *
 * Kernregel uit het productvoorstel: een rit is pas "bevestigd" wanneer een
 * vervoerder hem effectief heeft aanvaard. `requested` wordt aan de klant
 * nooit als geboekt getoond.
 */

export const RIDE_STATUSES = [
  'requested', // aanvraag loopt, nog geen vervoerder akkoord
  'accepted', // vervoerder heeft aanvaard, nog geen chauffeur
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'in_progress',
  'completed',
  'declined', // gekozen vervoerder weigerde
  'expired', // gekozen vervoerder antwoordde niet op tijd
  'unfulfilled', // open aanvraag: geen enkele vervoerder aanvaardde
  'cancelled_by_customer',
  'cancelled_by_operator',
  'cancelled_by_platform',
  'no_show', // klant niet komen opdagen
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

export type Actor = 'customer' | 'driver' | 'operator' | 'platform' | 'system';

export const TERMINAL_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>([
  'completed',
  'declined',
  'expired',
  'unfulfilled',
  'cancelled_by_customer',
  'cancelled_by_operator',
  'cancelled_by_platform',
  'no_show',
]);

/** Statussen die de klant als "bevestigde boeking" ziet. */
export const CONFIRMED_STATUSES: ReadonlySet<RideStatus> = new Set<RideStatus>([
  'accepted',
  'driver_assigned',
  'driver_en_route',
  'driver_arrived',
  'in_progress',
  'completed',
]);

type TransitionTable = Partial<Record<RideStatus, Partial<Record<RideStatus, readonly Actor[]>>>>;

const T: TransitionTable = {
  requested: {
    accepted: ['operator'],
    declined: ['operator'],
    expired: ['system'],
    unfulfilled: ['system'],
    cancelled_by_customer: ['customer'],
  },
  accepted: {
    driver_assigned: ['operator'],
    cancelled_by_customer: ['customer'],
    cancelled_by_operator: ['operator'],
  },
  driver_assigned: {
    driver_en_route: ['driver'],
    accepted: ['operator'], // chauffeur loskoppelen om opnieuw toe te wijzen
    cancelled_by_customer: ['customer'],
    cancelled_by_operator: ['operator'],
  },
  driver_en_route: {
    driver_arrived: ['driver'],
    cancelled_by_customer: ['customer'],
    cancelled_by_operator: ['operator'],
  },
  driver_arrived: {
    in_progress: ['driver'],
    no_show: ['driver'],
    cancelled_by_customer: ['customer'],
  },
  in_progress: {
    completed: ['driver'],
  },
};

export class TransitionError extends Error {
  constructor(
    public readonly from: RideStatus,
    public readonly to: RideStatus,
    public readonly actor: Actor,
  ) {
    super(`Overgang ${from} → ${to} niet toegestaan voor ${actor}`);
    this.name = 'TransitionError';
  }
}

export function canTransition(from: RideStatus, to: RideStatus, actor: Actor): boolean {
  if (actor === 'platform' && to === 'cancelled_by_platform') {
    return !TERMINAL_STATUSES.has(from);
  }
  return T[from]?.[to]?.includes(actor) ?? false;
}

export function assertTransition(from: RideStatus, to: RideStatus, actor: Actor): void {
  if (!canTransition(from, to, actor)) throw new TransitionError(from, to, actor);
}

export function isTerminal(status: RideStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isConfirmed(status: RideStatus): boolean {
  return CONFIRMED_STATUSES.has(status);
}

/** Klantvriendelijke label (NL/FR/EN). */
export const STATUS_LABELS: Record<RideStatus, { nl: string; fr: string; en: string }> = {
  requested: { nl: 'Wacht op bevestiging vervoerder', fr: 'En attente de confirmation', en: 'Awaiting operator confirmation' },
  accepted: { nl: 'Bevestigd', fr: 'Confirmée', en: 'Confirmed' },
  driver_assigned: { nl: 'Chauffeur toegewezen', fr: 'Chauffeur assigné', en: 'Driver assigned' },
  driver_en_route: { nl: 'Chauffeur onderweg', fr: 'Chauffeur en route', en: 'Driver on the way' },
  driver_arrived: { nl: 'Chauffeur aangekomen', fr: 'Chauffeur arrivé', en: 'Driver arrived' },
  in_progress: { nl: 'Rit bezig', fr: 'Course en cours', en: 'Ride in progress' },
  completed: { nl: 'Voltooid', fr: 'Terminée', en: 'Completed' },
  declined: { nl: 'Geweigerd door vervoerder', fr: 'Refusée par le transporteur', en: 'Declined by operator' },
  expired: { nl: 'Geen antwoord van vervoerder', fr: 'Pas de réponse du transporteur', en: 'Operator did not respond' },
  unfulfilled: { nl: 'Geen vervoerder beschikbaar', fr: 'Aucun transporteur disponible', en: 'No operator available' },
  cancelled_by_customer: { nl: 'Geannuleerd door jou', fr: 'Annulée par vous', en: 'Cancelled by you' },
  cancelled_by_operator: { nl: 'Geannuleerd door vervoerder', fr: 'Annulée par le transporteur', en: 'Cancelled by operator' },
  cancelled_by_platform: { nl: 'Geannuleerd door Ritna', fr: 'Annulée par Ritna', en: 'Cancelled by Ritna' },
  no_show: { nl: 'Niet komen opdagen', fr: 'Absent', en: 'No-show' },
};
