import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GET as statsGET } from "@/app/api/admin/stats/route";
import { POST as approvePOST } from "@/app/api/admin/marketplace/approve/route";
import { POST as createDemoPOST } from "@/app/api/white-label/create-demo/route";
import { createUser, loginAs, req } from "./helpers";

describe("admin authorization (role from DB session, no shared password)", () => {
  it("/api/admin/stats: 401 when logged out", async () => {
    const res = await statsGET();
    expect(res.status).toBe(401);
  });

  it("/api/admin/stats: 403 for a normal user, no personal data leaked", async () => {
    const u = await createUser();
    loginAs(u.id);
    const res = await statsGET();
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toContain("@example.test");
  });

  it("/api/admin/stats: 200 for an admin", async () => {
    const admin = await createUser({ role: "admin" });
    loginAs(admin.id);
    const res = await statsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.totalUsers).toBeGreaterThan(0);
    expect(body.overview.mrr).toBeUndefined(); // no estimated revenue figures
  });

  it("the old x-admin-password header grants nothing", async () => {
    process.env.ADMIN_PASSWORD = "letmein";
    const u = await createUser();
    loginAs(u.id);
    const r1 = await approvePOST(req("/api/admin/marketplace/approve", { body: { productId: "x", approved: true }, headers: { "x-admin-password": "letmein" } }));
    expect(r1.status).toBe(403);
    loginAs(null);
    const r2 = await createDemoPOST(req("/api/white-label/create-demo", { body: {}, headers: { "x-admin-password": "letmein" } }));
    expect(r2.status).toBe(401);
    delete process.env.ADMIN_PASSWORD;
  });

  it("no source file still references x-admin-password / ADMIN_PASSWORD (except the env guard)", () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== "generated") walk(p);
        } else if (/\.(ts|tsx)$/.test(f) && !p.endsWith("env-guard.ts")) {
          const s = readFileSync(p, "utf8");
          if (/x-admin-password|ADMIN_PASSWORD/.test(s)) hits.push(p);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});
