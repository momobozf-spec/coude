"use server";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/dal";
import { optStr, runAction, str } from "@/lib/action-helpers";
import { approveDigest, buildChangeAlert, buildWeeklyDigest, sendDigest, sendTestDigest } from "@/lib/services/digests";
import { getMailTransport } from "@/lib/mailer";

export async function createDigestAction(fd: FormData) {
  const admin = await requireAdmin();
  await runAction("/admin/digests", async () => {
    const orgId = z.uuid().parse(str(fd, "organizationId"));
    const kind = z.enum(["weekly", "change_alert"]).parse(str(fd, "kind"));
    if (kind === "weekly") {
      const d = await buildWeeklyDigest(db, orgId, { actorUserId: admin.id, intro: optStr(fd, "intro") });
      return { redirect: `/admin/digests/${d.id}`, message: d.items.length ? `Concept met ${d.items.length} kans(en).` : "Concept zonder kansen: de klant krijgt een eerlijk bericht dat er deze week niets geschikts was." };
    }
    const d = await buildChangeAlert(db, orgId, { since: new Date(Date.now() - 7 * 86_400_000), actorUserId: admin.id });
    if (!d) return "Geen wijzigingen bij gevolgde opdrachten in de voorbije 7 dagen.";
    return { redirect: `/admin/digests/${d.id}`, message: "Concept-wijzigingsmelding aangemaakt." };
  });
}

export async function approveDigestAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "digestId");
  await runAction(`/admin/digests/${id}`, async () => {
    await approveDigest(db, id, admin.id);
    return "Goedgekeurd. Verzending gebeurt pas na expliciete verzendactie.";
  });
}

export async function sendDigestAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "digestId");
  await runAction(`/admin/digests/${id}`, async () => {
    const r = await sendDigest(db, id, getMailTransport(), admin.id);
    if (r.notConfigured) return "E-mailverzending is niet ingesteld: niets verzonden. Gebruik de export.";
    return `Aan SMTP overhandigd: ${r.handedOff}, overgeslagen (al overhandigd): ${r.skipped}, mislukt/geweigerd: ${r.failed}. Aflevering in de mailbox is hiermee NIET bevestigd.`;
  });
}

export async function sendTestDigestAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "digestId");
  await runAction(`/admin/digests/${id}`, async () => {
    const r = await sendTestDigest(db, id, getMailTransport(), { id: admin.id, email: admin.email });
    if (r.status === "not_configured") return "Testverzending niet mogelijk: geen SMTP ingesteld.";
    if (r.status === "failed") throw new Error(`Testverzending mislukt: ${r.error}`);
    return `Testmail aan SMTP overhandigd (naar ${admin.email}). Telt niet als klantverzending.`;
  });
}
