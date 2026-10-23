import { describe, expect, it } from "vitest";
import { checkProductionConfig, demoAccountFilter } from "@/lib/production-guard";
import { LEGAL, legalAddress, legalLine } from "@/lib/legal";

const good = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://tk_app:Zr8s9xQ2@db.internal:5432/tenderkompas",
  BETTER_AUTH_SECRET: "x".repeat(44),
  BETTER_AUTH_URL: "https://app.tenderkompas.be",
  SMTP_HOST: "smtp.provider.eu",
  SMTP_FROM: "TenderKompas IT <digest@tenderkompas.be>",
  LEGAL_ENTITY_ADDRESS: "Straat 1, 1930 Zaventem",
};

describe("productie-guard", () => {
  it("geen fouten of waarschuwingen bij een correcte productieconfiguratie", () => {
    expect(checkProductionConfig(good)).toEqual({ errors: [], warnings: [] });
  });

  it("niet actief buiten productie of in staging", () => {
    expect(checkProductionConfig({ NODE_ENV: "development" }).errors).toEqual([]);
    expect(checkProductionConfig({ NODE_ENV: "production", APP_ENV: "staging" }).errors).toEqual([]);
  });

  it.each([
    ["DATABASE_URL", undefined, /DATABASE_URL ontbreekt/],
    ["DATABASE_URL", "postgres://tk:tk@localhost:5432/tenderkompas", /standaard/],
    ["DATABASE_URL", "postgres://postgres:lokaal@localhost:54329/tenderkompas", /standaard/],
    ["BETTER_AUTH_SECRET", "", /BETTER_AUTH_SECRET/],
    ["BETTER_AUTH_SECRET", "kort", /BETTER_AUTH_SECRET/],
    ["BETTER_AUTH_URL", "http://localhost:3000", /https/],
    ["BETTER_AUTH_URL", "https://localhost:3000", /localhost/],
    ["ALLOW_DEMO_DATA", "true", /ALLOW_DEMO_DATA/],
    ["DEMO_PASSWORD", "demo-wachtwoord-123", /DEMO_PASSWORD/],
    ["ADMIN_PASSWORD", "geheim-wachtwoord-1", /ADMIN_PASSWORD/],
    ["SMTP_ALLOW_SELF_SIGNED", "true", /SMTP_ALLOW_SELF_SIGNED/],
    ["SMTP_HOST", "127.0.0.1", /lokale test-SMTP/],
    ["SMTP_FROM", "TenderKompas IT <digest@example.invalid>", /SMTP_FROM/],
  ])("weigert %s=%s", (key, value, msg) => {
    const env: Record<string, string | undefined> = { ...good, [key]: value };
    const { errors } = checkProductionConfig(env);
    expect(errors.some((e) => msg.test(e))).toBe(true);
  });

  it("waarschuwt (maar weigert niet) zonder SMTP of adres", () => {
    const r = checkProductionConfig({ ...good, SMTP_HOST: "", LEGAL_ENTITY_ADDRESS: "" });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(2);
  });

  it("demo-accounts worden herkend aan het demo-domein", () => {
    expect(demoAccountFilter()).toBe("%@tenderkompas.test");
  });
});

describe("wettelijke vermeldingen", () => {
  it("BV-gegevens en adres uit LEGAL_ENTITY_ADDRESS, anders Zaventem", () => {
    expect(LEGAL.entityName).toBe("Marhaba Data & AI Agent BV");
    expect(LEGAL.enterpriseNumber).toBe("BE 1003.552.102");
    expect(legalAddress({})).toBe("Zaventem");
    expect(legalAddress({ LEGAL_ENTITY_ADDRESS: " Straat 1, 1930 Zaventem " })).toBe("Straat 1, 1930 Zaventem");
    expect(legalLine({})).toBe("TenderKompas IT is een dienst van Marhaba Data & AI Agent BV · ondernemingsnummer BE 1003.552.102 · Zaventem · momobozf@gmail.com");
  });
});
