import { describe, expect, it } from "vitest";
import { __redactForTest } from "./logger";

describe("logger redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const out = __redactForTest({ email: "a@b.be", nested: { phone: "0478", ok: 1 }, list: [{ token: "x" }] }) as Record<string, unknown>;
    expect(out["email"]).toBe("[redacted]");
    expect((out["nested"] as Record<string, unknown>)["phone"]).toBe("[redacted]");
    expect((out["nested"] as Record<string, unknown>)["ok"]).toBe(1);
    expect((out["list"] as Array<Record<string, unknown>>)[0]?.["token"]).toBe("[redacted]");
  });
});
