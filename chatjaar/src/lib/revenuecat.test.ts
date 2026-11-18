import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isValidAppUserId, isValidTransactionId, matchUnlock } from "./revenuecat";

const data = {
  subscriber: {
    non_subscriptions: {
      chatjaar_unlock: [
        { id: "cadba0c81b", store_transaction_id: "2000000123456789", store: "app_store", is_sandbox: true },
        { id: "ab12", store_transaction_id: "GPA.1234-5678-9012-34567", store: "play_store" },
      ],
      other_product: [{ id: "zzz", store_transaction_id: "999" }],
    },
    subscriber_attributes: { chatjaar_ai_runs_cadba0c81b: { value: "2" } },
  },
};

describe("RevenueCat unlock matching", () => {
  it("matches by store transaction id and reads the run counter", () => {
    expect(matchUnlock(data, "chatjaar_unlock", "2000000123456789")).toEqual({ runsKey: "chatjaar_ai_runs_cadba0c81b", runs: 2 });
  });
  it("matches by RevenueCat id and Google order id", () => {
    expect(matchUnlock(data, "chatjaar_unlock", "ab12")?.runs).toBe(0);
    expect(matchUnlock(data, "chatjaar_unlock", "GPA.1234-5678-9012-34567")?.runsKey).toBe("chatjaar_ai_runs_ab12");
  });
  it("rejects other products and unknown transactions", () => {
    expect(matchUnlock(data, "chatjaar_unlock", "999")).toBeNull();
    expect(matchUnlock(data, "chatjaar_unlock", "nope")).toBeNull();
    expect(matchUnlock({}, "chatjaar_unlock", "ab12")).toBeNull();
  });
  it("validates ids", () => {
    expect(isValidAppUserId("$RCAnonymousID:8f2a1c")).toBe(true);
    expect(isValidAppUserId("../../etc")).toBe(false);
    expect(isValidTransactionId("GPA.1234-5678-9012-34567")).toBe(true);
    expect(isValidTransactionId("a b")).toBe(false);
  });
});
