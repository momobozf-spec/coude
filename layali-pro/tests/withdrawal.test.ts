/**
 * Online herroepingsfunctie (Richtlijn (EU) 2023/2673), met mocks.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn() }));
const mail = vi.hoisted(() => ({
  emailConfigured: vi.fn(() => true),
  sendAdminWithdrawal: vi.fn(),
  sendWithdrawalAcknowledgement: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { order: { findFirst: db.findFirst, update: db.update } } }));
vi.mock("@/lib/resend", () => mail);

import { POST } from "@/app/api/withdrawal/route";
import { resetRateLimits } from "@/lib/rateLimit";

function req(body: unknown): Request {
  return new Request("https://shop.example/api/withdrawal", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" },
    body: JSON.stringify(body),
  });
}

const valid = { name: "Amina", email: "Amina@Example.be", orderNumber: "layali-2026-000001", confirm: true };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  mail.emailConfigured.mockReturnValue(true);
});

describe("herroeping via de site", () => {
  it("vereist naam, e-mail, bestelnummer en een uitdrukkelijke bevestiging", async () => {
    expect((await POST(req({ ...valid, confirm: false }))).status).toBe(400);
    expect((await POST(req({ ...valid, name: "" }))).status).toBe(400);
    expect((await POST(req({ ...valid, email: "geen-mail" }))).status).toBe(400);
  });

  it("markeert de bestelling en stuurt een ontvangstbevestiging met datum en tijd", async () => {
    db.findFirst.mockResolvedValue({ id: "o1", needsAttention: null });
    const res = await POST(req(valid));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.acknowledged).toBe(true);
    expect(new Date(body.receivedAt).toString()).not.toBe("Invalid Date");
    expect(db.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: "LAYALI-2026-000001", customerEmail: { equals: "amina@example.be", mode: "insensitive" } },
      }),
    );
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { needsAttention: expect.stringMatching(/^Herroeping ontvangen op /) } }),
    );
    const statement = mail.sendWithdrawalAcknowledgement.mock.calls[0]![0];
    expect(statement).toMatchObject({ email: "amina@example.be", orderNumber: "LAYALI-2026-000001", matchedOrder: true });
    expect(statement.receivedAt).toBeInstanceOf(Date);
  });

  it("weigert een verklaring nooit omdat de bestelling niet gevonden wordt", async () => {
    db.findFirst.mockResolvedValue(null);
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
    expect(mail.sendAdminWithdrawal.mock.calls[0]![0]).toMatchObject({ matchedOrder: false });
  });

  it("meldt eerlijk als er geen bevestigingsmail verstuurd kon worden", async () => {
    db.findFirst.mockResolvedValue(null);
    mail.emailConfigured.mockReturnValue(false);
    const body = await (await POST(req(valid))).json();
    expect(body).toMatchObject({ ok: true, acknowledged: false });
  });
});
