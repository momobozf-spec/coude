import { describe, expect, it } from "vitest";
import { assertPermission, assertSameTenant, hasPermission, tenantContextFor } from "./permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

describe("permissions", () => {
  it("enforces the role matrix", () => {
    expect(hasPermission("AGENT", "opportunity:write")).toBe(true);
    expect(hasPermission("AGENT", "opportunity:assign")).toBe(false);
    expect(hasPermission("AGENT", "crm:import")).toBe(false);
    expect(hasPermission("AGENT", "settings:write")).toBe(false);
    expect(hasPermission("AGENCY_ADMIN", "crm:import")).toBe(true);
    expect(hasPermission("AGENCY_ADMIN", "platform:admin")).toBe(false);
    expect(hasPermission("PLATFORM_ADMIN", "platform:admin")).toBe(true);
  });
  it("throws typed errors", () => {
    expect(() => assertPermission(null, "crm:read")).toThrow(UnauthorizedError);
    expect(() => assertPermission({ role: "AGENT" }, "users:manage")).toThrow(ForbiddenError);
    expect(() => assertPermission({ role: "AGENCY_ADMIN" }, "users:manage")).not.toThrow();
  });
  it("binds agency users to their own agency regardless of request", () => {
    const ctx = tenantContextFor({ id: "u1", role: "AGENT", agencyId: "a1" }, "a2");
    expect(ctx.agencyId).toBe("a1");
    expect(() => tenantContextFor({ id: "u1", role: "AGENT", agencyId: null })).toThrow(ForbiddenError);
    expect(tenantContextFor({ id: "p", role: "PLATFORM_ADMIN", agencyId: null }, "a2").agencyId).toBe("a2");
    expect(() => tenantContextFor({ id: "p", role: "PLATFORM_ADMIN", agencyId: null })).toThrow(ForbiddenError);
  });
  it("assertSameTenant rejects other tenants and missing entities", () => {
    const ctx = { userId: "u", role: "AGENT" as const, agencyId: "a1" };
    expect(() => assertSameTenant(ctx, { agencyId: "a1" })).not.toThrow();
    expect(() => assertSameTenant(ctx, { agencyId: "a2" })).toThrow(ForbiddenError);
    expect(() => assertSameTenant(ctx, null)).toThrow(ForbiddenError);
  });
});
