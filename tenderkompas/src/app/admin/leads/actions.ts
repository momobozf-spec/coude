"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leadRequest } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { runAction, str } from "@/lib/action-helpers";
import { audit } from "@/lib/audit";

export async function setLeadStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  await runAction("/admin/leads", async () => {
    const id = z.uuid().parse(str(fd, "leadId"));
    const status = z.enum(["contacted", "rejected", "delete"]).parse(str(fd, "status"));
    if (status === "delete") {
      await db.delete(leadRequest).where(eq(leadRequest.id, id));
      await audit(db, { actorUserId: admin.id, action: "lead.deleted", entityType: "lead_request", entityId: id });
      return "Aanvraag verwijderd.";
    }
    await db.update(leadRequest).set({ status }).where(eq(leadRequest.id, id));
    return "Status bijgewerkt.";
  });
}
