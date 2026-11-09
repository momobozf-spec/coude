import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/printful/route";
import { createUser, req } from "./helpers";

async function makeOrder() {
  const u = await createUser();
  const book = await prisma.coloringBook.create({ data: { userId: u.id, title: "Book", childName: "Test" } });
  return prisma.bookOrder.create({
    data: { userId: u.id, bookId: book.id, unitPrice: 10, totalPrice: 10, status: "paid", printfulOrderId: "777" },
  });
}

const shipped = (externalId: string, printfulId = "777") => ({
  type: "package_shipped",
  data: { order: { id: Number(printfulId), external_id: externalId }, shipment: { tracking_url: "https://t", tracking_number: "T1" } },
});

describe("Printful webhook", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_BOOKS = "true";
    process.env.PRINTFUL_WEBHOOK_SECRET = "pf-secret-123";
  });

  it("is disabled (404) when the books module is off or no secret is set", async () => {
    process.env.NEXT_PUBLIC_FEATURE_BOOKS = "false";
    expect((await POST(req("/api/webhooks/printful?token=pf-secret-123", { body: shipped("x") }))).status).toBe(404);
    process.env.NEXT_PUBLIC_FEATURE_BOOKS = "true";
    delete process.env.PRINTFUL_WEBHOOK_SECRET;
    expect((await POST(req("/api/webhooks/printful?token=", { body: shipped("x") }))).status).toBe(404);
  });

  it("rejects missing or wrong token", async () => {
    const order = await makeOrder();
    expect((await POST(req("/api/webhooks/printful", { body: shipped(order.id) }))).status).toBe(401);
    expect((await POST(req("/api/webhooks/printful?token=wrong", { body: shipped(order.id) }))).status).toBe(401);
    expect((await prisma.bookOrder.findUnique({ where: { id: order.id } }))?.status).toBe("paid");
  });

  it("rejects a payload whose Printful order id does not match", async () => {
    const order = await makeOrder();
    const res = await POST(req("/api/webhooks/printful?token=pf-secret-123", { body: shipped(order.id, "999") }));
    expect(res.status).toBe(404);
    expect((await prisma.bookOrder.findUnique({ where: { id: order.id } }))?.status).toBe("paid");
  });

  it("updates the order with a valid token and matching ids", async () => {
    const order = await makeOrder();
    const res = await POST(req("/api/webhooks/printful?token=pf-secret-123", { body: shipped(order.id) }));
    expect(res.status).toBe(200);
    const after = await prisma.bookOrder.findUnique({ where: { id: order.id } });
    expect(after?.status).toBe("shipped");
    expect(after?.trackingNumber).toBe("T1");
  });
});
