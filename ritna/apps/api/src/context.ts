import type { Notifier, PaymentProvider, RoutingProvider } from './adapters.js';
import type { Db } from './db.js';

export interface Ctx {
  db: Db;
  payments: PaymentProvider;
  routing: RoutingProvider;
  notifier: Notifier;
  /** Injecteerbare klok zodat tests tijd kunnen laten verstrijken. */
  now: () => Date;
  commissionVatBps: number;
}
