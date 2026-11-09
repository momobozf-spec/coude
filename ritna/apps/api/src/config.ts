export interface Config {
  databaseUrl: string;
  jwtSecret: string;
  port: number;
  /** BTW op commissie (bps). Te bevestigen door boekhouder. */
  commissionVatBps: number;
  /** Interval van de achtergrondjob die verlopen aanvragen afhandelt. */
  tickIntervalMs: number;
  paymentProvider: 'fake';
  routingProvider: 'straight_line';
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Omgevingsvariabele ${name} ontbreekt`);
  return v;
}

export function loadConfig(): Config {
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET moet minstens 32 tekens lang zijn');
  return {
    databaseUrl: required('DATABASE_URL'),
    jwtSecret,
    port: Number(process.env.PORT ?? 3000),
    commissionVatBps: Number(process.env.COMMISSION_VAT_BPS ?? 2100),
    tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? 15_000),
    paymentProvider: 'fake',
    routingProvider: 'straight_line',
  };
}
