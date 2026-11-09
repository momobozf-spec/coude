import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { assessment, digest, emailDelivery, fact, membership, organization, procedure, trackedOpportunity, user } from "@/db/schema";
import { renderDigest, type DigestItem } from "@/lib/domain/digest-render";
import { opportunityState } from "@/lib/domain/lifecycle";
import { describeDeadline, deadlineComparable } from "@/lib/time";
import type { MailTransport } from "@/lib/mailer";
import { audit } from "@/lib/audit";

const MAX_ITEMS = 5;

function appUrl() {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

function nextDeadline(facts: (typeof fact.$inferSelect)[], now: Date) {
  const candidates = facts
    .filter((f) => !f.supersededAt && (f.key === "submission_deadline" || f.key === "participation_deadline"))
    .map((f) => ({ f, at: deadlineComparable(f) }))
    .filter((x) => x.at && x.at.getTime() > now.getTime())
    .sort((a, b) => a.at!.getTime() - b.at!.getTime());
  if (!candidates.length) return { label: "onbekend", caveat: "geen deadline vastgesteld in de bron", at: null as Date | null };
  const d = describeDeadline(candidates[0].f);
  const kind = candidates[0].f.key === "participation_deadline" ? "deelname" : "indiening";
  return { label: `${d.label} (${kind})`, caveat: d.caveat, at: candidates[0].at };
}

export async function recipientsFor(database: DB, organizationId: string) {
  const org = await database.query.organization.findFirst({ where: eq(organization.id, organizationId) });
  if (!org) throw new Error("Organisatie niet gevonden");
  if (org.notificationSettings.recipients.length) return org.notificationSettings.recipients;
  const members = await database
    .select({ email: user.email })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.organizationId, organizationId));
  return members.map((m) => m.email);
}

/** Selecteert uitsluitend gepubliceerde, actuele, open kansen die nog in geen verzonden digest stonden. */
export async function selectWeeklyItems(database: DB, organizationId: string, now: Date) {
  const rows = await database
    .select({ a: assessment, p: procedure })
    .from(assessment)
    .innerJoin(procedure, eq(procedure.id, assessment.procedureId))
    .where(and(eq(assessment.organizationId, organizationId), eq(assessment.status, "published"), eq(assessment.stale, false)));
  const sent = await database
    .select({ items: digest.items })
    .from(digest)
    .where(and(eq(digest.organizationId, organizationId), eq(digest.kind, "weekly"), inArray(digest.status, ["handed_to_smtp", "partially_handed"])));
  const alreadySent = new Set(sent.flatMap((d) => d.items.map((i) => i.assessmentId)));
  const pendingNewer = await database
    .select({ procedureId: assessment.procedureId })
    .from(assessment)
    .where(and(eq(assessment.organizationId, organizationId), eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved"])));
  const pendingSet = new Set(pendingNewer.map((x) => x.procedureId));
  const procIds = rows.map((r) => r.p.id);
  const facts = procIds.length
    ? await database.select().from(fact).where(and(inArray(fact.procedureId, procIds), isNull(fact.supersededAt)))
    : [];
  const candidates = rows
    .filter(({ a, p }) => a.advice !== "not_suitable" && !alreadySent.has(a.id) && !pendingSet.has(p.id))
    .map(({ a, p }) => {
      const pf = facts.filter((f) => f.procedureId === p.id);
      return { a, p, state: opportunityState(p, pf, now), deadline: nextDeadline(pf, now) };
    })
    .filter((x) => x.state.open)
    .sort((x, y) => {
      if (x.a.advice !== y.a.advice) return x.a.advice === "investigate" ? -1 : 1;
      const xa = x.deadline.at?.getTime() ?? Infinity;
      const ya = y.deadline.at?.getTime() ?? Infinity;
      return xa - ya;
    });
  return candidates.slice(0, MAX_ITEMS);
}

export async function buildWeeklyDigest(database: DB, organizationId: string, opts: { now?: Date; actorUserId: string | null; intro?: string | null }) {
  const now = opts.now ?? new Date();
  const org = await database.query.organization.findFirst({ where: eq(organization.id, organizationId) });
  if (!org) throw new Error("Organisatie niet gevonden");
  const items = await selectWeeklyItems(database, organizationId, now);
  const periodStart = new Date(now.getTime() - 7 * 86_400_000);
  const rendered = renderDigest({
    kind: "weekly",
    organizationName: org.name,
    periodStart,
    periodEnd: now,
    intro: opts.intro ?? null,
    portalUrl: `${appUrl()}/portal`,
    items: items.map<DigestItem>(({ a, p, deadline }) => ({
      title: p.title,
      buyerName: p.buyerName,
      advice: a.advice,
      relevanceScore: a.relevanceScore,
      nextDeadlineLabel: deadline.label,
      deadlineCaveat: deadline.caveat,
      fitExplanation: a.fitExplanation,
      nextAction: a.nextAction,
      url: `${appUrl()}/portal/kansen/${p.id}`,
    })),
  });
  const [row] = await database
    .insert(digest)
    .values({
      organizationId,
      kind: "weekly",
      periodStart,
      periodEnd: now,
      status: "draft",
      subject: rendered.subject,
      intro: opts.intro ?? null,
      items: items.map(({ a, p }) => ({ assessmentId: a.id, procedureId: p.id })),
      html: rendered.html,
      textBody: rendered.textBody,
    })
    .returning();
  await audit(database, { actorUserId: opts.actorUserId, organizationId, action: "digest.drafted", entityType: "digest", entityId: row.id, details: { items: items.length } });
  return row;
}

/** Conceptmelding voor belangrijke wijzigingen bij gevolgde opdrachten. */
export async function buildChangeAlert(database: DB, organizationId: string, opts: { since: Date; now?: Date; actorUserId: string | null }) {
  const now = opts.now ?? new Date();
  const org = await database.query.organization.findFirst({ where: eq(organization.id, organizationId) });
  if (!org) throw new Error("Organisatie niet gevonden");
  const rows = await database
    .select({ p: procedure })
    .from(trackedOpportunity)
    .innerJoin(procedure, eq(procedure.id, trackedOpportunity.procedureId))
    .where(and(eq(trackedOpportunity.organizationId, organizationId), gte(procedure.fingerprintChangedAt, opts.since)));
  if (!rows.length) return null;
  const items: DigestItem[] = [];
  const refs: { assessmentId: string; procedureId: string }[] = [];
  for (const { p } of rows) {
    const latestPublished = await database.query.assessment.findFirst({
      where: and(eq(assessment.organizationId, organizationId), eq(assessment.procedureId, p.id), eq(assessment.status, "published")),
      orderBy: desc(assessment.version),
    });
    if (!latestPublished) continue; // klant ziet enkel wat ooit gepubliceerd werd
    const pf = await database.select().from(fact).where(and(eq(fact.procedureId, p.id), isNull(fact.supersededAt)));
    const d = nextDeadline(pf, now);
    const state = opportunityState(p, pf, now);
    const reviewed = !latestPublished.stale && latestPublished.procedureFingerprint === p.fingerprint;
    items.push({
      title: p.title,
      buyerName: p.buyerName,
      advice: latestPublished.advice,
      relevanceScore: latestPublished.relevanceScore,
      nextDeadlineLabel: state.open ? d.label : "geen open inschrijving meer",
      deadlineCaveat: state.open ? d.caveat : null,
      fitExplanation: null,
      nextAction: null,
      url: `${appUrl()}/portal/kansen/${p.id}`,
      changePending: !reviewed,
      changeNote: reviewed
        ? "De wijziging is gecontroleerd; de beoordeling in het portaal is bijgewerkt."
        : "De bron is gewijzigd. Onze controle loopt nog; de huidige beoordeling kan verouderd zijn.",
    });
    refs.push({ assessmentId: latestPublished.id, procedureId: p.id });
  }
  if (!items.length) return null;
  const rendered = renderDigest({ kind: "change_alert", organizationName: org.name, periodStart: opts.since, periodEnd: now, items, portalUrl: `${appUrl()}/portal` });
  const [row] = await database
    .insert(digest)
    .values({ organizationId, kind: "change_alert", periodStart: opts.since, periodEnd: now, status: "draft", subject: rendered.subject, items: refs, html: rendered.html, textBody: rendered.textBody })
    .returning();
  await audit(database, { actorUserId: opts.actorUserId, organizationId, action: "change_alert.drafted", entityType: "digest", entityId: row.id });
  return row;
}

export async function approveDigest(database: DB, digestId: string, actorUserId: string) {
  const d = await database.query.digest.findFirst({ where: eq(digest.id, digestId) });
  if (!d) throw new Error("Digest niet gevonden");
  if (d.status !== "draft") throw new Error("Alleen een concept kan goedgekeurd worden.");
  if (d.kind === "weekly" && d.items.length) {
    const ids = d.items.map((i) => i.assessmentId);
    const ok = await database
      .select({ id: assessment.id })
      .from(assessment)
      .where(and(inArray(assessment.id, ids), eq(assessment.status, "published"), eq(assessment.stale, false)));
    if (ok.length !== ids.length)
      throw new Error("Eén of meer kansen zijn niet meer gepubliceerd of actueel. Maak een nieuw concept.");
  }
  await database.update(digest).set({ status: "approved", approvedAt: new Date(), approvedByUserId: actorUserId }).where(eq(digest.id, digestId));
  await audit(database, { actorUserId, organizationId: d.organizationId, action: "digest.approved", entityType: "digest", entityId: digestId });
}

/**
 * Idempotente KLANTverzending: unieke sleutel per (digest, ontvanger); een reeds aan SMTP overhandigde e-mail wordt
 * nooit opnieuw verstuurd, ook niet bij het opnieuw uitvoeren van de taak.
 * Statussen zijn bewust eerlijk: "handed_to_smtp" = aanvaard door de SMTP-server ≠ afgeleverd in de mailbox.
 */
export async function sendDigest(database: DB, digestId: string, transport: MailTransport | null, actorUserId: string | null) {
  const d = await database.query.digest.findFirst({ where: eq(digest.id, digestId) });
  if (!d) throw new Error("Digest niet gevonden");
  if (!["approved", "partially_handed", "failed", "not_configured", "handed_to_smtp", "sending"].includes(d.status))
    throw new Error("Digest moet eerst door de beheerder goedgekeurd worden.");
  const org = await database.query.organization.findFirst({ where: eq(organization.id, d.organizationId) });
  if (!org) throw new Error("Organisatie niet gevonden");
  const pref = d.kind === "weekly" ? org.notificationSettings.weeklyDigest : org.notificationSettings.changeAlerts;
  if (!pref) throw new Error("De klant heeft dit type melding uitgeschakeld in de notificatievoorkeuren.");
  const recipients = Array.from(new Set((await recipientsFor(database, d.organizationId)).map((r) => r.trim().toLowerCase()).filter(Boolean)));
  if (!recipients.length) throw new Error("Geen ontvangers ingesteld.");

  for (const r of recipients) {
    await database
      .insert(emailDelivery)
      .values({ digestId, kind: "client", recipient: r, idempotencyKey: `${digestId}:client:${r}`, status: "pending" })
      .onConflictDoNothing();
  }

  if (!transport) {
    await database
      .update(emailDelivery)
      .set({ status: "not_configured", lastError: "Geen e-mailprovider ingesteld (SMTP_HOST leeg)." })
      .where(and(eq(emailDelivery.digestId, digestId), eq(emailDelivery.kind, "client"), inArray(emailDelivery.status, ["pending", "failed"])));
    await database.update(digest).set({ status: "not_configured" }).where(eq(digest.id, digestId));
    await audit(database, { actorUserId, organizationId: d.organizationId, action: "digest.send_not_configured", entityType: "digest", entityId: digestId });
    return { handedOff: 0, skipped: 0, failed: 0, notConfigured: recipients.length };
  }

  await database.update(digest).set({ status: "sending" }).where(eq(digest.id, digestId));
  let handedOff = 0,
    failed = 0,
    skipped = 0;
  const deliveries = await database.select().from(emailDelivery).where(and(eq(emailDelivery.digestId, digestId), eq(emailDelivery.kind, "client")));
  for (const del of deliveries) {
    if (del.status === "handed_to_smtp") {
      skipped++;
      continue;
    }
    // Claim (atomair) zodat parallelle of herhaalde runs niet dubbel verzenden.
    const claimed = await database
      .update(emailDelivery)
      .set({ status: "sending", attempts: del.attempts + 1 })
      .where(and(eq(emailDelivery.id, del.id), inArray(emailDelivery.status, ["pending", "failed", "not_configured"])))
      .returning();
    if (!claimed.length) {
      skipped++;
      continue;
    }
    const outcome = await handOff(transport, { to: del.recipient, subject: d.subject, html: d.html, text: d.textBody, idempotencyKey: del.idempotencyKey });
    await database.update(emailDelivery).set(outcome.update).where(eq(emailDelivery.id, del.id));
    if (outcome.ok) handedOff++;
    else failed++;
  }
  const all = await database.select().from(emailDelivery).where(and(eq(emailDelivery.digestId, digestId), eq(emailDelivery.kind, "client")));
  const n = all.filter((x) => x.status === "handed_to_smtp").length;
  const status = n === all.length ? "handed_to_smtp" : n > 0 ? "partially_handed" : "failed";
  await database.update(digest).set({ status }).where(eq(digest.id, digestId));
  await audit(database, { actorUserId, organizationId: d.organizationId, action: "digest.send", entityType: "digest", entityId: digestId, details: { handedOff, failed, skipped } });
  return { handedOff, skipped, failed, notConfigured: 0 };
}

async function handOff(transport: MailTransport, msg: Parameters<MailTransport["send"]>[0]) {
  try {
    const res = await transport.send(msg);
    const rejected = res.rejected.includes(msg.to.toLowerCase());
    if (rejected || !res.accepted.includes(msg.to.toLowerCase())) {
      return {
        ok: false,
        update: { status: "failed", smtpResponse: res.response, lastError: `SMTP-server weigerde ontvanger${res.response ? `: ${res.response}` : ""}`.slice(0, 500) },
      };
    }
    return {
      ok: true,
      update: { status: "handed_to_smtp", providerMessageId: res.messageId, smtpResponse: res.response, handedOffAt: new Date(), lastError: null },
    };
  } catch (e) {
    return { ok: false, update: { status: "failed", lastError: e instanceof Error ? e.message.slice(0, 500) : "onbekende fout" } };
  }
}

/**
 * TESTverzending: uitsluitend naar het eigen adres van de beheerder, onderwerp met [TEST]-prefix.
 * Wijzigt de digeststatus niet en telt nooit als verzending naar de klant. Mag ook voor een concept.
 */
export async function sendTestDigest(database: DB, digestId: string, transport: MailTransport | null, admin: { id: string; email: string }) {
  const d = await database.query.digest.findFirst({ where: eq(digest.id, digestId) });
  if (!d) throw new Error("Digest niet gevonden");
  const to = admin.email.trim().toLowerCase();
  const clientRecipients = (await recipientsFor(database, d.organizationId)).map((r) => r.toLowerCase());
  if (clientRecipients.includes(to)) throw new Error("Testverzending naar een klantadres is niet toegestaan.");
  const [row] = await database
    .insert(emailDelivery)
    .values({ digestId, kind: "test", recipient: to, idempotencyKey: `${digestId}:test:${to}:${Date.now()}`, status: "pending", attempts: 1 })
    .returning();
  if (!transport) {
    await database.update(emailDelivery).set({ status: "not_configured", lastError: "Geen e-mailprovider ingesteld." }).where(eq(emailDelivery.id, row.id));
    return { status: "not_configured" as const };
  }
  const outcome = await handOff(transport, { to, subject: `[TEST] ${d.subject}`, html: d.html, text: d.textBody, idempotencyKey: row.idempotencyKey });
  await database.update(emailDelivery).set(outcome.update).where(eq(emailDelivery.id, row.id));
  await audit(database, { actorUserId: admin.id, organizationId: d.organizationId, action: "digest.test_send", entityType: "digest", entityId: digestId, details: { ok: outcome.ok } });
  return { status: outcome.update.status as "handed_to_smtp" | "failed", error: "lastError" in outcome.update ? outcome.update.lastError : null };
}
