import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as claimPOST } from "@/app/api/referral/claim/route";
import { REFERRAL_BONUS } from "@/lib/referral";
import { createUser, loginAs, req } from "./helpers";

describe("referral claim", () => {
  it("requires login", async () => {
    const res = await claimPOST(req("/api/referral/claim", { body: { referralCode: "ABCD1234" } }));
    expect(res.status).toBe(401);
  });

  it("ignores userId in the body, credits once, is idempotent", async () => {
    const referrer = await createUser({ referralCode: "REFA2345" });
    const me = await createUser();
    const victim = await createUser();
    loginAs(me.id);

    const r1 = await claimPOST(req("/api/referral/claim", { body: { referralCode: "REFA2345", userId: victim.id } }));
    expect(r1.status).toBe(200);
    const r2 = await claimPOST(req("/api/referral/claim", { body: { referralCode: "REFA2345" } }));
    expect(r2.status).toBe(409);

    const ref = await prisma.user.findUnique({ where: { id: referrer.id } });
    expect(ref?.bonusGenerations).toBe(REFERRAL_BONUS);
    expect(ref?.referralCount).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: me.id } }))?.referredBy).toBe("REFA2345");
    expect((await prisma.user.findUnique({ where: { id: victim.id } }))?.referredBy).toBeNull();
  });

  it("parallel claims are credited only once", async () => {
    const referrer = await createUser({ referralCode: "REFB2345" });
    const me = await createUser();
    loginAs(me.id);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimPOST(req("/api/referral/claim", { body: { referralCode: "REFB2345" } })))
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const ref = await prisma.user.findUnique({ where: { id: referrer.id } });
    expect(ref?.bonusGenerations).toBe(REFERRAL_BONUS);
  });

  it("rejects self-referral and unknown codes", async () => {
    const me = await createUser({ referralCode: "SELF2345" });
    loginAs(me.id);
    expect((await claimPOST(req("/api/referral/claim", { body: { referralCode: "SELF2345" } }))).status).toBe(400);
    expect((await claimPOST(req("/api/referral/claim", { body: { referralCode: "NOPE2345" } }))).status).toBe(404);
  });
});
