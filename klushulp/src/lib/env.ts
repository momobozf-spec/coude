/** Centrale, gevalideerde omgevingsconfiguratie. Server-only. */
function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} is geen geheel getal: ${v}`);
  return n;
}

export const env = {
  get nodeEnv() { return process.env.NODE_ENV ?? "development"; },
  get appEnv() { return process.env.APP_ENV ?? ""; },
  get isProduction() { return this.nodeEnv === "production" && this.appEnv !== "staging"; },
  get baseUrl() { return process.env.BETTER_AUTH_URL ?? "http://localhost:3000"; },
  get platformFeeBps() { return int("PLATFORM_FEE_BPS", 1000); },
  get platformFeeMinCents() { return int("PLATFORM_FEE_MIN_CENTS", 500); },
  get storageDir() { return process.env.STORAGE_DIR ?? "./storage"; },
  get uploadMaxBytes() { return int("UPLOAD_MAX_BYTES", 5 * 1024 * 1024); },
  get stripeConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY); },
  get smtpConfigured() { return Boolean(process.env.SMTP_HOST); },
  get aiConfigured() { return Boolean(process.env.ANTHROPIC_API_KEY); },
  get allowDemoData() { return process.env.ALLOW_DEMO_DATA === "true" && process.env.NODE_ENV !== "production"; },
  get legal() {
    return {
      name: process.env.LEGAL_ENTITY_NAME ?? "",
      vat: process.env.LEGAL_ENTITY_VAT ?? "",
      address: process.env.LEGAL_ENTITY_ADDRESS ?? "",
    };
  },
};
