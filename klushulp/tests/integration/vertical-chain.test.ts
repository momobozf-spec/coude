import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createRequest, getRequestByToken, expandRequest, providerPublicStats, RequestError } from "@/lib/services/requests";
import { sendProposal, acceptProposal, assertProviderCanSeeRequest, ProposalError, withdrawProposal } from "@/lib/services/proposals";
import { transitionBooking, createReview, BookingError } from "@/lib/services/bookings";
import { sendMessage, listThread, MessageError } from "@/lib/services/messages";
import { activateProvider, missingRequiredVerifications, AdminError } from "@/lib/services/admin";
import { resetDb, makeProvider, baseRequest, nextWeekday, makeUser } from "../helpers";

const futureStart = () => new Date(`${nextWeekday(new Date(), 3)}T09:00:00+01:00`).toISOString();
const proposalInput = (overrides: Record<string, unknown> = {}) => ({
  priceType: "fixed" as const,
  amountCents: 12_000,
  amountMinCents: null,
  amountMaxCents: null,
  hourlyRateCents: null,
  estimatedHoursMin: null,
  estimatedHoursMax: null,
  travelFeeCents: 2_000,
  materialsIncluded: false,
  materialsNote: "",
  included: "Kraan vervangen",
  excluded: "Nieuwe kraan zelf aankopen",
  proposedStart: futureStart(),
  durationHours: 2,
  message: "Ik kom graag langs.",
  ...overrides,
});

describe("verticale keten: aanvraag → matching → voorstel → acceptatie → afspraak → afronding → beoordeling", () => {
  beforeEach(resetDb);

  it("1. een klant plaatst een klus zonder account en krijgt een toegangstoken", async () => {
    await makeProvider();
    const { request, matchCount } = await createRequest(baseRequest);
    expect(request.accessToken.length).toBeGreaterThanOrEqual(40);
    expect(request.status).toBe("open");
    expect(request.customerUserId).toBeNull();
    expect(matchCount).toBe(1);
    const view = await getRequestByToken(request.accessToken);
    expect(view?.request.id).toBe(request.id);
    expect(await getRequestByToken("ongeldig-token-ongeldig-token-ongeldig-token-xx")).toBeNull();
  });

  it("2. een passende dienstverlener wordt gematcht en kan reageren; platformkosten worden berekend", async () => {
    const { provider } = await makeProvider();
    const { request } = await createRequest(baseRequest);
    await expect(assertProviderCanSeeRequest(provider.id, request.id)).resolves.toBeTruthy();
    const p = await sendProposal(provider.id, request.id, proposalInput());
    expect(p.status).toBe("sent");
    // 10 % van 120,00 = 12,00 (boven minimum 5,00)
    expect(p.platformFeeCents).toBe(1_200);
    // Tweede voorstel op dezelfde aanvraag is niet toegestaan.
    await expect(sendProposal(provider.id, request.id, proposalInput())).rejects.toMatchObject({ code: "already_sent" });
  });

  it("3. een niet-passende dienstverlener krijgt geen toegang (categorie, werkgebied, beschikbaarheid, status)", async () => {
    const other = await makeProvider({ categories: ["electrical"] }); // verkeerde categorie
    const far = await makeProvider({ postcode: "2990", radiusKm: 5 }); // Wuustwezel, te ver van Berchem
    const noSlots = await makeProvider({ slots: [] }); // geen beschikbaarheid
    const pending = await makeProvider({ status: "pending" }); // nog niet actief
    const { request, matchCount } = await createRequest(baseRequest);
    expect(matchCount).toBe(0);
    for (const p of [other, far, noSlots, pending]) {
      await expect(assertProviderCanSeeRequest(p.provider.id, request.id)).rejects.toMatchObject({ code: "not_matched" });
      await expect(sendProposal(p.provider.id, request.id, proposalInput())).rejects.toMatchObject({ code: "not_matched" });
      await expect(sendMessage({ requestId: request.id, providerId: p.provider.id, senderRole: "provider", body: "hallo" })).rejects.toBeInstanceOf(MessageError);
    }
  });

  it("3b. beschikbaarheid binnen de gewenste periode telt mee; uitbreiding voegt alleen nieuwe matches toe", async () => {
    // Enkel zaterdag beschikbaar; klant wil een weekdag.
    const sat = await makeProvider({ slots: [[6, 9 * 60, 13 * 60]] });
    const day = nextWeekday(new Date(), 3);
    const { request, matchCount } = await createRequest({ ...baseRequest, dateFrom: day, dateTo: day });
    expect(matchCount).toBe(0);
    await expect(assertProviderCanSeeRequest(sat.provider.id, request.id)).rejects.toMatchObject({ code: "not_matched" });
    const added = await expandRequest(request.id, { extraRadiusKm: 0, ignoreDates: true });
    expect(added).toBe(1);
    await expect(assertProviderCanSeeRequest(sat.provider.id, request.id)).resolves.toBeTruthy();
    expect(await expandRequest(request.id, { extraRadiusKm: 0, ignoreDates: true })).toBe(0);
  });

  it("4. een voorstel accepteren maakt één boeking; een tweede acceptatie en dubbele boeking zijn onmogelijk", async () => {
    const a = await makeProvider();
    const b = await makeProvider({ postcode: "2640" });
    const { request } = await createRequest(baseRequest);
    const pa = await sendProposal(a.provider.id, request.id, proposalInput());
    const pb = await sendProposal(b.provider.id, request.id, proposalInput({ amountCents: 9_000 }));

    // Gelijktijdige acceptaties: precies één slaagt.
    const results = await Promise.allSettled([acceptProposal(request.id, pa.id), acceptProposal(request.id, pb.id)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const bookings = await db.select().from(schema.booking).where(eq(schema.booking.requestId, request.id));
    expect(bookings).toHaveLength(1);
    expect(bookings[0].paymentProvider).toBe("simulated");
    expect(bookings[0].paymentStatus).toBe("simulated");

    const view = await getRequestByToken(request.accessToken);
    expect(view?.request.status).toBe("booked");
    const statuses = view!.proposals.map((p) => p.proposal.status).sort();
    expect(statuses).toEqual(["accepted", "declined"]);
    await expect(acceptProposal(request.id, pb.id)).rejects.toMatchObject({ code: "already_booked" });
    // Na boeking kan niemand nog een voorstel sturen.
    const c = await makeProvider({ postcode: "2610" });
    await expect(sendProposal(c.provider.id, request.id, proposalInput())).rejects.toBeInstanceOf(ProposalError);
  });

  it("5. gesprekken zijn per aanvraag × dienstverlener gescheiden", async () => {
    const a = await makeProvider();
    const b = await makeProvider({ postcode: "2640" });
    const { request } = await createRequest(baseRequest);
    await sendMessage({ requestId: request.id, providerId: a.provider.id, senderRole: "customer", body: "Hallo A" });
    await sendMessage({ requestId: request.id, providerId: a.provider.id, senderRole: "provider", body: "Dag klant" });
    await sendMessage({ requestId: request.id, providerId: b.provider.id, senderRole: "customer", body: "Hallo B" });
    expect((await listThread(request.id, a.provider.id)).map((m) => m.body)).toEqual(["Hallo A", "Dag klant"]);
    expect((await listThread(request.id, b.provider.id)).map((m) => m.body)).toEqual(["Hallo B"]);
    // Andere aanvraag van dezelfde klant: geen overlap.
    const { request: other } = await createRequest({ ...baseRequest, description: "Tweede klus: toilet loopt door, al een week." });
    expect(await listThread(other.id, a.provider.id)).toHaveLength(0);
  });

  it("6. een afgeronde boeking krijgt precies één geldige beoordeling", async () => {
    const a = await makeProvider();
    const { request } = await createRequest(baseRequest);
    const p = await sendProposal(a.provider.id, request.id, proposalInput());
    const bk = await acceptProposal(request.id, p.id);
    // Nog niet afgerond: geen beoordeling.
    await expect(createReview(bk.id, { rating: 5, body: "Top" }, "Test")).rejects.toMatchObject({ code: "not_completed" });
    // Klant mag niet zelf afronden.
    await expect(transitionBooking(bk.id, "completed", { role: "customer" })).rejects.toMatchObject({ code: "forbidden" });
    // Andere dienstverlener mag niet aan deze boeking.
    const b = await makeProvider({ postcode: "2640" });
    await expect(transitionBooking(bk.id, "completed", { role: "provider", providerId: b.provider.id })).rejects.toMatchObject({ code: "forbidden" });
    await transitionBooking(bk.id, "in_progress", { role: "provider", providerId: a.provider.id });
    await transitionBooking(bk.id, "completed", { role: "provider", providerId: a.provider.id });
    const r = await createReview(bk.id, { rating: 4, body: "Netjes gedaan" }, "Test");
    expect(r.rating).toBe(4);
    await expect(createReview(bk.id, { rating: 1, body: "" }, "Test")).rejects.toMatchObject({ code: "already_reviewed" });
    const stats = (await providerPublicStats([a.provider.id]))[a.provider.id];
    expect(stats).toMatchObject({ reviewCount: 1, avgRating: 4, completedJobs: 1 });
    expect(stats.verifications).toEqual(["kbo"]);
    const view = await getRequestByToken(request.accessToken);
    expect(view?.request.status).toBe("completed");
  });

  it("7. annuleren door de klant sluit de boeking en de aanvraag; ongeldige overgangen falen", async () => {
    const a = await makeProvider();
    const { request } = await createRequest(baseRequest);
    const p = await sendProposal(a.provider.id, request.id, proposalInput());
    const bk = await acceptProposal(request.id, p.id);
    await transitionBooking(bk.id, "cancelled", { role: "customer" }, { reason: "Zelf opgelost" });
    const [after] = await db.select().from(schema.booking).where(eq(schema.booking.id, bk.id));
    expect(after.status).toBe("cancelled");
    expect(after.cancelledBy).toBe("customer");
    await expect(transitionBooking(bk.id, "completed", { role: "provider", providerId: a.provider.id })).rejects.toMatchObject({ code: "bad_transition" });
    const view = await getRequestByToken(request.accessToken);
    expect(view?.request.status).toBe("cancelled");
  });

  it("8. voorstel intrekken en gerichte aanvraag naar één dienstverlener", async () => {
    const a = await makeProvider();
    const b = await makeProvider({ postcode: "2640" });
    const { request, matchCount } = await createRequest({ ...baseRequest, targetProviderId: a.provider.id });
    expect(matchCount).toBe(1);
    await expect(assertProviderCanSeeRequest(b.provider.id, request.id)).rejects.toMatchObject({ code: "not_matched" });
    const p = await sendProposal(a.provider.id, request.id, proposalInput());
    await withdrawProposal(a.provider.id, p.id);
    await expect(withdrawProposal(b.provider.id, p.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(acceptProposal(request.id, p.id)).rejects.toMatchObject({ code: "not_open" });
    // Gerichte aanvraag naar een dienstverlener buiten de categorie wordt geweigerd.
    const el = await makeProvider({ categories: ["electrical"] });
    await expect(createRequest({ ...baseRequest, targetProviderId: el.provider.id })).rejects.toMatchObject({ code: "provider_not_matching" });
  });

  it("9. invoervalidatie: onbekende postcode, verkeerde datums, onbekende categorie", async () => {
    await expect(createRequest({ ...baseRequest, postcode: "9999" })).rejects.toMatchObject({ code: "unknown_postcode" });
    await expect(createRequest({ ...baseRequest, dateFrom: "2020-01-01", dateTo: "2020-01-02" })).rejects.toMatchObject({ code: "bad_dates" });
    await expect(createRequest({ ...baseRequest, categorySlug: "nope" })).rejects.toBeInstanceOf(RequestError);
  });

  it("10. beheer: activeren kan pas met goedgekeurde vereiste verificaties; badges volgen uit verificaties", async () => {
    const admin = await makeUser("admin");
    const { provider } = await makeProvider({ status: "pending" });
    await db.update(schema.providerVerification).set({ status: "pending" }).where(eq(schema.providerVerification.providerId, provider.id));
    expect(await missingRequiredVerifications(provider.id)).toEqual(["kbo"]);
    await expect(activateProvider(provider.id, admin.id)).rejects.toBeInstanceOf(AdminError);
    expect((await providerPublicStats([provider.id]))[provider.id].verifications).toEqual([]);
    await db.update(schema.providerVerification).set({ status: "approved" }).where(eq(schema.providerVerification.providerId, provider.id));
    await activateProvider(provider.id, admin.id);
    const [p] = await db.select().from(schema.provider).where(eq(schema.provider.id, provider.id));
    expect(p.status).toBe("active");
    expect((await providerPublicStats([provider.id]))[provider.id].verifications).toEqual(["kbo"]);
  });

  it("11. een beoordeling vereist een boeking; BookingError op onbekende boeking", async () => {
    await expect(createReview("bestaat-niet", { rating: 5, body: "" }, "x")).rejects.toBeInstanceOf(BookingError);
  });
});
