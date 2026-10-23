/**
 * Mollie-flow met mocks (geen database, geen netwerk):
 * - de webhook vertrouwt nooit de status uit het verzoek, maar haalt de
 *   betaling op bij Mollie;
 * - onbekende of vervalste ids veranderen niets;
 * - markOrderPaid is idempotent: een tweede webhook doet niets meer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  updateMany: vi.fn(),
  txFindUnique: vi.fn(),
  txUpdate: vi.fn(),
  couponUpdateMany: vi.fn(),
}));
const mollie = vi.hoisted(() => ({ getMolliePayment: vi.fn() }));
const mail = vi.hoisted(() => ({ sendOrderConfirmation: vi.fn(), sendAdminNewOrder: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const tx = {
    order: { updateMany: db.updateMany, findUnique: db.txFindUnique, update: db.txUpdate },
    product: { updateMany: vi.fn() },
    couponCode: { updateMany: db.couponUpdateMany },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    prisma: {
      order: { findUnique: db.orderFindUnique },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("@/lib/mollie", () => mollie);
vi.mock("@/lib/resend", () => mail);

import { POST } from "@/app/api/webhooks/mollie/route";
import { markOrderPaid } from "@/lib/orders";

function form(body: Record<string, string>): Request {
  return new Request("https://shop.example/api/webhooks/mollie", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

const paidOrder = {
  id: "order_1",
  orderNumber: "LAYALI-2026-000001",
  total: 24.95,
  subtotal: 19.95,
  shipping: 5,
  discount: 0,
  customerEmail: "klant@example.be",
  couponCode: null,
  stockReleasedAt: null,
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Mollie-webhook", () => {
  it("weigert een ongeldig of ontbrekend betaal-id zonder Mollie te bevragen", async () => {
    expect((await POST(form({}))).status).toBe(400);
    expect((await POST(form({ id: "'; DROP TABLE" }))).status).toBe(400);
    expect(mollie.getMolliePayment).not.toHaveBeenCalled();
  });

  it("negeert een status in het verzoek en haalt de echte status op bij Mollie", async () => {
    db.orderFindUnique.mockResolvedValue({ id: "order_1" });
    mollie.getMolliePayment.mockResolvedValue({
      id: "tr_test1234",
      status: "open",
      amount: { value: "24.95", currency: "EUR" },
      metadata: { orderId: "order_1" },
    });
    const res = await POST(form({ id: "tr_test1234", status: "paid" }));
    expect(res.status).toBe(200);
    expect(mollie.getMolliePayment).toHaveBeenCalledWith("tr_test1234");
    // Mollie zegt "open": er wordt niets als betaald gemarkeerd.
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("bevestigt een onbekende betaling zonder iets te wijzigen", async () => {
    db.orderFindUnique.mockResolvedValue(null);
    const res = await POST(form({ id: "tr_onbekend1" }));
    expect(res.status).toBe(200);
    expect(mollie.getMolliePayment).not.toHaveBeenCalled();
  });

  it("negeert een betaling die volgens Mollie bij een andere order hoort", async () => {
    db.orderFindUnique.mockResolvedValue({ id: "order_1" });
    mollie.getMolliePayment.mockResolvedValue({
      id: "tr_test1234",
      status: "paid",
      amount: { value: "24.95", currency: "EUR" },
      metadata: { orderId: "andere_order" },
    });
    expect((await POST(form({ id: "tr_test1234" }))).status).toBe(200);
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("markeert betaald als Mollie 'paid' meldt, en geeft 500 bij een Mollie-fout zodat Mollie opnieuw probeert", async () => {
    db.orderFindUnique.mockResolvedValue({ id: "order_1" });
    mollie.getMolliePayment.mockResolvedValue({
      id: "tr_test1234",
      status: "paid",
      amount: { value: "24.95", currency: "EUR" },
      metadata: { orderId: "order_1" },
    });
    db.updateMany.mockResolvedValue({ count: 1 });
    db.txFindUnique.mockResolvedValue(paidOrder);
    expect((await POST(form({ id: "tr_test1234" }))).status).toBe(200);
    expect(db.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order_1", paymentStatus: { notIn: ["PAID", "REFUNDED"] } } }),
    );
    expect(mail.sendOrderConfirmation).toHaveBeenCalledTimes(1);

    mollie.getMolliePayment.mockRejectedValue(new Error("Mollie API-fout 503"));
    expect((await POST(form({ id: "tr_test1234" }))).status).toBe(500);
  });
});

describe("markOrderPaid (idempotentie)", () => {
  it("doet de tweede keer niets en verstuurt geen tweede bevestiging", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    db.txFindUnique.mockResolvedValue(paidOrder);
    const payment = { amountValue: "24.95", currency: "EUR", provider: "mollie" };

    expect(await markOrderPaid("order_1", payment)).toBe(true);
    expect(await markOrderPaid("order_1", payment)).toBe(false);
    expect(mail.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(mail.sendAdminNewOrder).toHaveBeenCalledTimes(1);
  });

  it("zet een afwijkend bedrag op 'opvolgen' in plaats van het stil te aanvaarden", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.txFindUnique.mockResolvedValue(paidOrder);
    await markOrderPaid("order_1", { amountValue: "1.00", currency: "EUR", provider: "mollie" });
    expect(db.txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { needsAttention: expect.stringMatching(/wijkt af/) } }),
    );
  });
});
