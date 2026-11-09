/**
 * Integratietests tegen een echte PostgreSQL (TEST_DATABASE_URL), met de
 * migraties toegepast. Zonder TEST_DATABASE_URL worden ze overgeslagen.
 *
 *   TEST_DATABASE_URL=postgresql://layali:layali@localhost:5432/layali_test npm test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const d = url ? describe : describe.skip;

// Statische imports: prisma.ts maakt pas verbinding bij het eerste gebruik,
// dus DATABASE_URL hierboven zetten volstaat.
import { prisma } from "@/lib/prisma";
import { createPendingOrder, markOrderPaid, releaseOrder, cancelPaidOrder } from "@/lib/orders";
import { quoteCheckout, CheckoutError } from "@/lib/checkout";
import { createPasswordReset, resetPasswordWithToken } from "@/lib/passwords";

d("bestellingen en voorraad (PostgreSQL)", () => {
  let userId = "";
  let categoryId = "";

  async function product(stock: number, price = 20) {
    return prisma.product.create({
      data: { name: `P${Math.random()}`, slug: `p-${Math.random().toString(36).slice(2)}`, description: "d", price, stock, categoryId },
    });
  }

  async function order(productId: string, quantity: number) {
    const p = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const quote = quoteCheckout([{ productId, quantity }], new Map([[p.id, p]]), "standard", null);
    return createPendingOrder({
      userId,
      customerEmail: "klant@example.be",
      address: { firstName: "A", lastName: "B", email: "klant@example.be", street: "S", houseNumber: "1", postalCode: "1000", city: "Brussel", country: "BE" },
      shippingMethod: "standard",
      quote,
    });
  }

  const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "OrderItem","Order","Product","Category","PasswordResetToken","User" RESTART IDENTITY CASCADE`,
    );
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "order_number_seq" RESTART WITH 1`);
    userId = (await prisma.user.create({ data: { email: "klant@example.be", password: "x" } })).id;
    categoryId = (await prisma.category.create({ data: { name: "Cat", slug: "cat" } })).id;
  });

  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reserveert voorraad bij het aanmaken en geeft opeenvolgende ordernummers", async () => {
    const p = await product(5);
    const a = await order(p.id, 2);
    const b = await order(p.id, 1);
    expect(await stockOf(p.id)).toBe(2);
    const year = new Date().getFullYear();
    expect(a.orderNumber).toMatch(new RegExp(`^LAYALI-${year}-\\d{6}$`));
    expect(Number(b.orderNumber.slice(-6))).toBe(Number(a.orderNumber.slice(-6)) + 1);
    expect(a.total).toBe(45.95);
  });

  it("verkoopt het laatste stuk maar één keer, ook bij gelijktijdige bestellingen", async () => {
    const p = await product(1);
    const results = await Promise.allSettled([order(p.id, 1), order(p.id, 1), order(p.id, 1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(2);
    for (const r of rejected) expect(r.reason).toBeInstanceOf(CheckoutError);
    expect(await stockOf(p.id)).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it("geeft de voorraad precies één keer vrij bij een mislukte betaling", async () => {
    const p = await product(3);
    const o = await order(p.id, 2);
    expect(await releaseOrder(o.id, "CANCELLED")).toBe(true);
    expect(await releaseOrder(o.id, "CANCELLED")).toBe(false);
    expect(await stockOf(p.id)).toBe(3);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.status).toBe("CANCELLED");
  });

  it("markeert betaald maar één keer, en laat een betaalde order niet meer annuleren door een late webhook", async () => {
    const p = await product(3);
    const o = await order(p.id, 1);
    const pay = { amountValue: o.total.toFixed(2), currency: "EUR", provider: "mollie" };
    const [x, y] = await Promise.all([markOrderPaid(o.id, pay), markOrderPaid(o.id, pay)]);
    expect([x, y].filter(Boolean)).toHaveLength(1);
    expect(await releaseOrder(o.id, "CANCELLED")).toBe(false);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.paymentStatus).toBe("PAID");
    expect(after.status).toBe("PROCESSING");
    expect(after.needsAttention).toBeNull();
    expect(await stockOf(p.id)).toBe(2);
  });

  it("betaald na verlopen: reserveert opnieuw, of vlagt de order als de voorraad op is", async () => {
    const p = await product(1);
    const o = await order(p.id, 1);
    await releaseOrder(o.id, "CANCELLED");
    // Intussen koopt iemand anders het laatste stuk.
    await order(p.id, 1);
    await markOrderPaid(o.id, { amountValue: o.total.toFixed(2), currency: "EUR", provider: "mollie" });
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.paymentStatus).toBe("PAID");
    expect(after.needsAttention).toMatch(/onvoldoende voorraad/);
    expect(await stockOf(p.id)).toBe(0);
  });

  it("vlagt een afwijkend betaald bedrag", async () => {
    const p = await product(2);
    const o = await order(p.id, 1);
    await markOrderPaid(o.id, { amountValue: "0.01", currency: "EUR", provider: "mollie" });
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.needsAttention).toMatch(/wijkt af/);
  });

  it("annuleren na betaling zet de voorraad terug en vraagt om terugbetaling", async () => {
    const p = await product(2);
    const o = await order(p.id, 2);
    await markOrderPaid(o.id, { amountValue: o.total.toFixed(2), currency: "EUR", provider: "mollie" });
    expect(await cancelPaidOrder(o.id, true)).toBe(true);
    expect(await cancelPaidOrder(o.id, true)).toBe(false);
    expect(await stockOf(p.id)).toBe(2);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.needsAttention).toMatch(/terugbetalen/);
  });

  it("een herstellink werkt één keer en maakt oude sessies ongeldig", async () => {
    await prisma.user.update({ where: { id: userId }, data: { password: "$2a$12$abcdefghijklmnopqrstuuOkb0eWQyQ8x1h1c3Gk2PZqTvJmW3eS" } });
    const token = await createPasswordReset("klant@example.be");
    expect(token).toBeTruthy();
    expect(await createPasswordReset("onbekend@example.be")).toBeNull();
    expect(await resetPasswordWithToken(token!, "een-nieuw-wachtwoord")).toBe(true);
    expect(await resetPasswordWithToken(token!, "nog-een-wachtwoord")).toBe(false);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordChangedAt).not.toBeNull();
    expect(u.failedLoginAttempts).toBe(0);
  });

  it("een verlopen herstellink werkt niet", async () => {
    const token = await createPasswordReset("klant@example.be", new Date(Date.now() - 2 * 60 * 60 * 1000));
    expect(await resetPasswordWithToken(token!, "een-nieuw-wachtwoord")).toBe(false);
  });
});
