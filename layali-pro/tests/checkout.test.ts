import { describe, expect, it } from "vitest";
import {
  CheckoutError,
  checkoutRequestSchema,
  couponProblem,
  quoteCheckout,
  type CouponRecord,
  type PricedProduct,
} from "@/lib/checkout";

const address = {
  firstName: "Sara",
  lastName: "Test",
  email: "Sara@Example.be",
  street: "Teststraat",
  houseNumber: "1",
  postalCode: "1930",
  city: "Zaventem",
  country: "BE",
};

const products = new Map<string, PricedProduct>([
  ["glas", { id: "glas", name: "Theeglazen", price: 34.95, stock: 5, status: "ACTIVE" }],
  ["kaars", { id: "kaars", name: "Kaars", price: 19.99, stock: 1, status: "ACTIVE" }],
  ["oud", { id: "oud", name: "Oud", price: 10, stock: 10, status: "ARCHIVED" }],
]);

const coupon = (over: Partial<CouponRecord> = {}): CouponRecord => ({
  code: "WELKOM10",
  discountType: "PERCENTAGE",
  discountValue: 10,
  active: true,
  minOrder: null,
  maxUses: null,
  usedCount: 0,
  validFrom: null,
  expiresAt: null,
  ...over,
});

describe("checkoutRequestSchema", () => {
  const base = { items: [{ productId: "glas", quantity: 1 }], shippingAddress: address };

  it("aanvaardt een geldige bestelling en normaliseert het e-mailadres", () => {
    const r = checkoutRequestSchema.parse(base);
    expect(r.shippingAddress.email).toBe("sara@example.be");
    expect(r.shippingMethod).toBe("standard");
    expect(r.locale).toBe("nl");
  });

  it.each([0, -1, 1.5, 21])("weigert hoeveelheid %s", (quantity) => {
    expect(checkoutRequestSchema.safeParse({ ...base, items: [{ productId: "glas", quantity }] }).success).toBe(false);
  });

  it("weigert een land waar niet geleverd wordt", () => {
    expect(
      checkoutRequestSchema.safeParse({ ...base, shippingAddress: { ...address, country: "FR" } }).success,
    ).toBe(false);
  });

  it("negeert meegestuurde prijzen (die zitten niet in het schema)", () => {
    const r = checkoutRequestSchema.parse({ ...base, items: [{ productId: "glas", quantity: 1, price: 0.01 }] });
    expect(r.items[0]).not.toHaveProperty("price");
  });
});

describe("quoteCheckout", () => {
  it("rekent subtotaal, verzending en totaal in centen", () => {
    const q = quoteCheckout([{ productId: "glas", quantity: 2 }], products, "standard", null);
    expect(q.subtotalCents).toBe(6990);
    expect(q.shippingCents).toBe(595);
    expect(q.totalCents).toBe(7585);
    expect(q.lines[0]!.productName).toBe("Theeglazen");
  });

  it("zet een gevraagde cadeauverpakking bij de orderregel, zonder meerprijs", () => {
    const q = quoteCheckout([{ productId: "glas", quantity: 1, giftWrap: true }], products, "standard", null);
    expect(q.lines[0]!.productName).toBe("Theeglazen (cadeauverpakking)");
    expect(q.subtotalCents).toBe(3495);
  });

  it("past een geldige kortingscode toe", () => {
    const q = quoteCheckout([{ productId: "glas", quantity: 3 }], products, "standard", coupon());
    expect(q.subtotalCents).toBe(10485);
    expect(q.discountCents).toBe(1049);
    expect(q.shippingCents).toBe(0);
    expect(q.totalCents).toBe(9436);
    expect(q.couponCode).toBe("WELKOM10");
  });

  it("negeert een verlopen of uitgeputte kortingscode", () => {
    const expired = quoteCheckout([{ productId: "glas", quantity: 1 }], products, "standard", coupon({ expiresAt: new Date(0) }));
    expect(expired.discountCents).toBe(0);
    expect(expired.couponCode).toBeNull();
    const used = quoteCheckout([{ productId: "glas", quantity: 1 }], products, "standard", coupon({ maxUses: 1, usedCount: 1 }));
    expect(used.discountCents).toBe(0);
  });

  it("telt dezelfde artikelen in verschillende kleuren samen voor de voorraad", () => {
    expect(() =>
      quoteCheckout(
        [
          { productId: "kaars", quantity: 1, color: "rood" },
          { productId: "kaars", quantity: 1, color: "goud" },
        ],
        products,
        "standard",
        null,
      ),
    ).toThrow(CheckoutError);
  });

  it("weigert een gearchiveerd of onbekend product", () => {
    expect(() => quoteCheckout([{ productId: "oud", quantity: 1 }], products, "standard", null)).toThrow(CheckoutError);
    expect(() => quoteCheckout([{ productId: "bestaat-niet", quantity: 1 }], products, "standard", null)).toThrow(CheckoutError);
  });
});

describe("couponProblem", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  it("controleert minimum, geldigheid en gebruik", () => {
    expect(couponProblem(coupon(), 1000, now)).toBeNull();
    expect(couponProblem(coupon({ active: false }), 1000, now)).toMatch(/niet meer actief/);
    expect(couponProblem(coupon({ validFrom: new Date("2026-11-01") }), 1000, now)).toMatch(/nog niet geldig/);
    expect(couponProblem(coupon({ minOrder: 30 }), 2999, now)).toMatch(/minimumbedrag/);
    expect(couponProblem(coupon({ minOrder: 30 }), 3000, now)).toBeNull();
  });
});
