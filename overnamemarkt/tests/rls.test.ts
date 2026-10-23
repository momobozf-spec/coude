import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Test van de toegangsregels uit supabase/migrations/0001_init.sql tegen een echte Postgres (PGlite).
 * Supabase-specifieke onderdelen (auth-schema, rollen, auth.uid()) worden hier nagebootst.
 */
const A = "00000000-0000-4000-8000-00000000000a"; // verkoper
const B = "00000000-0000-4000-8000-00000000000b"; // koper
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function submit(user: string, title = "Planningstool voor schoonmaak") {
  const r = await as(
    user,
    `select public.submit_listing($1,'SaaS','BE',2021,180000,72000,41000,140,'Laravel','Nieuw project',
      'Roosters en uren voor kleine schoonmaakbedrijven.','v@example.com',true,true) as id`,
    [title],
  );
  return r.rows[0].id as string;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const migration = readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0001_init.sql"), "utf8")
    .replace("create extension if not exists pgcrypto;", "");
  await db.exec(migration);
  await db.exec(`
    insert into auth.users (id, email) values ('${A}','a@example.com'), ('${B}','b@example.com'), ('${ADMIN}','admin@example.com');
    update public.profiles set role = 'admin' where id = '${ADMIN}';
  `);
});

describe("aanbiedingen", () => {
  let listingId = "";

  it("profielen worden automatisch aangemaakt", async () => {
    const r = await db.query("select count(*)::int as n from public.profiles");
    expect(r.rows[0]).toEqual({ n: 3 });
  });

  it("een nieuwe aanbieding staat altijd ter controle, ook als je zelf 'published' probeert", async () => {
    listingId = await submit(A);
    await as(A, `insert into public.listings (title,type,country,asking_price,revenue_12m,profit_12m,description,consent_accuracy,consent_publish,status)
      values ('Poging tot directe publicatie','App','NL',1000,0,0,'Deze probeert de controle over te slaan.',true,true,'published')`);
    const r = await db.query<{ status: string }>("select status from public.listings order by created_at");
    expect(r.rows.map((x) => x.status)).toEqual(["pending", "pending"]);
  });

  it("een aanbieding ter controle is onzichtbaar voor anderen", async () => {
    expect((await as(null, "select id from public.listings")).rows).toHaveLength(0);
    expect((await as(B, "select id from public.listings")).rows).toHaveLength(0);
    expect((await as(A, "select id from public.listings")).rows).toHaveLength(2);
    expect((await as(ADMIN, "select id from public.listings")).rows).toHaveLength(2);
  });

  it("een verkoper kan zijn aanbieding niet zelf publiceren of wijzigen", async () => {
    const r = await as(A, "update public.listings set status = 'published', asking_price = 1 where id = $1", [listingId]);
    expect(r.affectedRows ?? 0).toBe(0);
    const s = await db.query<{ status: string }>("select status from public.listings where id = $1", [listingId]);
    expect(s.rows[0].status).toBe("pending");
  });

  it("niemand kan zichzelf admin maken", async () => {
    await as(A, "update public.profiles set role = 'admin' where id = $1", [A]).catch(() => null);
    const r = await db.query<{ role: string }>("select role from public.profiles where id = $1", [A]);
    expect(r.rows[0].role).toBe("user");
  });

  it("contactadressen zijn nooit publiek", async () => {
    await expect(as(null, "select * from public.listing_contacts")).rejects.toThrow();
    expect((await as(B, "select * from public.listing_contacts")).rows).toHaveLength(0);
    expect((await as(A, "select * from public.listing_contacts")).rows).toHaveLength(1);
    expect((await as(ADMIN, "select * from public.listing_contacts")).rows).toHaveLength(1);
  });

  it("interesse tonen kan niet op een aanbieding ter controle", async () => {
    await expect(
      as(B, "insert into public.interests (listing_id,message,contact_email,consent_confidential,consent_share) values ($1,'Ik wil meer weten aub.','b@example.com',true,true)", [listingId]),
    ).rejects.toThrow();
  });

  it("de beheerder publiceert, daarna is de aanbieding publiek", async () => {
    await as(ADMIN, "update public.listings set status = 'published' where id = $1", [listingId]);
    const r = await as(null, "select id, published_at from public.listings");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].published_at).not.toBeNull();
  });

  it("een koper toont interesse, maar één keer per aanbieding", async () => {
    const ins = "insert into public.interests (listing_id,message,contact_email,consent_confidential,consent_share) values ($1,'Ik wil meer weten aub.','b@example.com',true,true)";
    await as(B, ins, [listingId]);
    await expect(as(B, ins, [listingId])).rejects.toThrow();
  });

  it("de verkoper kan geen interesse tonen voor zijn eigen aanbieding", async () => {
    await expect(
      as(A, "insert into public.interests (listing_id,message,contact_email,consent_confidential,consent_share) values ($1,'Mijn eigen aanbieding test.','a@example.com',true,true)", [listingId]),
    ).rejects.toThrow();
  });

  it("kopersgegevens zijn alleen zichtbaar voor de koper zelf en de beheerder", async () => {
    expect((await as(A, "select * from public.interests")).rows).toHaveLength(0);
    expect((await as(B, "select * from public.interests")).rows).toHaveLength(1);
    expect((await as(ADMIN, "select * from public.interests")).rows).toHaveLength(1);
    expect((await as(null, "select count(*) from public.listings")).rows).toHaveLength(1);
  });

  it("de verkoper ziet alleen het aantal geïnteresseerden", async () => {
    expect((await as(A, "select public.interest_count($1) as n", [listingId])).rows[0].n).toBe(1);
    expect((await as(B, "select public.interest_count($1) as n", [listingId])).rows[0].n).toBe(0);
  });

  it("alleen de eigenaar kan intrekken", async () => {
    await expect(as(B, "select public.withdraw_listing($1)", [listingId])).rejects.toThrow();
    await as(A, "select public.withdraw_listing($1)", [listingId]);
    const r = await db.query<{ status: string }>("select status from public.listings where id = $1", [listingId]);
    expect(r.rows[0].status).toBe("withdrawn");
    expect((await as(null, "select id from public.listings")).rows).toHaveLength(0);
  });

  it("maximaal 5 aanbiedingen tegelijk ter controle", async () => {
    // A heeft er nu 1 ter controle (de directe poging). Nog 4 lukken, de 6de niet.
    for (let i = 0; i < 4; i++) await submit(A, `Extra aanbieding nummer ${i}`);
    await expect(submit(A, "Een aanbieding te veel")).rejects.toThrow(/5 aanbiedingen/);
  });
});
