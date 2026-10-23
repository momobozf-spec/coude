"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { leadRequest } from "@/db/schema";
import { audit } from "@/lib/audit";

const leadSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(200),
  email: z.email().max(200),
  website: z.string().trim().max(300).optional().transform((s) => s || null),
  teamSize: z.string().trim().max(30).optional().transform((s) => s || null),
  focus: z.string().trim().max(200).optional().transform((s) => s || null),
  message: z.string().trim().max(2000).optional().transform((s) => s || null),
  consent: z.literal("on"),
});

export async function createLeadAction(fd: FormData) {
  if (String(fd.get("bedrijf_url") ?? "")) redirect("/?ok=" + encodeURIComponent("Bedankt, we nemen contact op.") + "#aanvraag");
  const parsed = leadSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect("/?fout=" + encodeURIComponent("Controleer de verplichte velden en uw toestemming.") + "#aanvraag");
  const d = parsed.data;
  const [row] = await db
    .insert(leadRequest)
    .values({ companyName: d.companyName, contactName: d.contactName, email: d.email.toLowerCase(), website: d.website, teamSize: d.teamSize, focus: d.focus, message: d.message, consent: true })
    .returning({ id: leadRequest.id });
  await audit(db, { action: "lead.created", entityType: "lead_request", entityId: row.id });
  redirect("/?ok=" + encodeURIComponent("Bedankt, uw aanvraag is ontvangen. We nemen persoonlijk contact op.") + "#aanvraag");
}
