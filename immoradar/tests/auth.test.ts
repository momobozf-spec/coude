import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { allowedTransitions } from "@/services/workflow-service";

describe("password hashing", () => {
  it("verifies the correct password and rejects wrong ones", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
  it("produces unique salts", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(verifyPassword("x", "scrypt$bad")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid session", () => {
    const token = createSessionToken("user-123");
    const payload = verifySessionToken(token);
    expect(payload?.userId).toBe("user-123");
  });
  it("rejects tampered tokens", () => {
    const token = createSessionToken("user-123");
    const [body, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ userId: "user-456", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forgedBody}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${body}.AAAA${sig!.slice(4)}`)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
  });
  it("rejects expired tokens", () => {
    const eightDaysAgo = Date.now() - 8 * 86_400_000;
    const token = createSessionToken("user-123", eightDaysAgo);
    expect(verifySessionToken(token)).toBeNull();
    expect(verifySessionToken(token, eightDaysAgo + 1000)).not.toBeNull();
  });
});

describe("pipeline permissions (status transitions)", () => {
  it("enforces the acquisition lifecycle", () => {
    expect(allowedTransitions("NEW")).toContain("ASSIGNED");
    expect(allowedTransitions("CONTACTED")).toContain("INTERESTED");
    expect(allowedTransitions("MANDATE_WON")).toEqual([]);
    expect(allowedTransitions("NEW")).not.toContain("MANDATE_WON");
    expect(allowedTransitions("VALUATION_BOOKED")).toContain("MANDATE_PROPOSED");
  });
});
