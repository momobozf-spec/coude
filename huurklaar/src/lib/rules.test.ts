import { describe, expect, it } from "vitest";
import { budgetCheck, dossierScore, forbiddenAsked, monthlyTotal, todoKeys, verdict } from "./rules";

describe("budgetCheck", () => {
  it("rekent de 3x-norm op huur + kosten + garage", () => {
    // Voorbeeld uit de makelaarspraktijk: 500 + 50 + 50 → 1.800 nodig
    const total = monthlyTotal(500, 50, 50);
    const b = budgetCheck(total, 1800);
    expect(total).toBe(600);
    expect(b.required).toBe(1800);
    expect(b.level).toBe("warn");
  });
  it("is ruim vanaf 3,3x", () => {
    expect(budgetCheck(1000, 3300).level).toBe("ok");
    expect(budgetCheck(1000, 3299).level).toBe("warn");
    expect(budgetCheck(1000, 2999).level).toBe("bad");
  });
  it("geeft het maximale betaalbare bedrag", () => {
    expect(budgetCheck(1000, 3800).maxAffordable).toBe(1266);
  });
  it("crasht niet op lege of negatieve invoer", () => {
    const b = budgetCheck(0, -50);
    expect(b.ratio).toBe(0);
    expect(b.level).toBe("bad");
    expect(monthlyTotal(NaN, -10, 20)).toBe(20);
  });
});

describe("dossierScore", () => {
  const base = {
    totalMonthly: 1010,
    netIncome: 3800,
    job: "vast" as const,
    monthsEmployed: 38,
    docs: ["d_id", "d_pay", "d_job"] as ("d_id" | "d_pay" | "d_job")[],
    about: "Ik werk als verpleegkundige in Antwerpen. We zijn rustig en roken niet.",
  };
  it("telt de onderdelen op", () => {
    const r = dossierScore(base);
    expect(r.parts).toEqual({ budgetPts: 40, docPts: 15, stabilityPts: 15, motivationPts: 10 });
    expect(r.score).toBe(80);
  });
  it("haalt 100 met alles compleet", () => {
    const r = dossierScore({ ...base, docs: ["d_id", "d_pay", "d_job", "d_ref", "d_rent", "d_ins", "d_guar"] });
    expect(r.score).toBe(100);
  });
  it("telt dubbele documenten niet dubbel", () => {
    const r = dossierScore({ ...base, docs: ["d_id", "d_id", "d_id"] as never });
    expect(r.parts.docPts).toBe(5);
  });
  it("geeft de juiste verdicten", () => {
    expect(verdict(85)).toBe("vTop");
    expect(verdict(70)).toBe("vGood");
    expect(verdict(50)).toBe("vMid");
    expect(verdict(49)).toBe("vLow");
  });
});

describe("todoKeys", () => {
  it("zet budgetprobleem bovenaan", () => {
    const t = todoKeys({ totalMonthly: 1000, netIncome: 2000, job: "vast", monthsEmployed: 2, docs: [], about: "" });
    expect(t[0]).toBe("t_budgetNo");
    expect(t).toContain("t_months");
    expect(t).toContain("t_about");
  });
});

describe("forbiddenAsked", () => {
  it("markeert alleen verboden vragen", () => {
    const r = forbiddenAsked(["q_id", "q_pay", "q_birthplace", "q_cash"]);
    expect(r.map((x) => x.key)).toEqual(["q_birthplace", "q_cash"]);
  });
});
