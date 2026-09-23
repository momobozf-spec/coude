import type { Db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/lib/auth/permissions";
import type { CrmContactInput } from "@/domain/contact/types";
import type { CrmAdapter } from "@/crm/adapters/crm-adapter";
import { CsvCrmAdapter } from "@/crm/adapters/csv-crm-adapter";
import { normalizeContact, planMerge } from "@/crm/contact-normalizer";
import { foldText, normalizeAddress } from "@/normalization/normalizers";
import { audit } from "./audit";

const log = createLogger({ component: "leadrevive-import" });

export interface ImportSummary {
  importId: string;
  totalRows: number;
  created: number;
  updated: number;
  duplicates: number;
  conflicts: number;
  invalid: number;
}

/** Resolve "Thomas" / "thomas peeters" / "T. Peeters" to an active user of the agency. */
export function resolveAgentUserId(assignedAgent: string | null, users: Array<{ id: string; name: string; email: string }>): string | null {
  const needle = foldText(assignedAgent);
  if (!needle) return null;
  const exact = users.find((u) => foldText(u.name) === needle || u.email.toLowerCase() === needle);
  if (exact) return exact.id;
  const byFirst = users.filter((u) => (foldText(u.name) ?? "").split(" ")[0] === needle.split(" ")[0]);
  if (byFirst.length === 1) return byFirst[0]!.id;
  const byLast = users.filter((u) => (foldText(u.name) ?? "").split(" ").slice(-1)[0] === needle.split(" ").slice(-1)[0]);
  if (byLast.length === 1) return byLast[0]!.id;
  return null;
}

/** Import contacts from any CRM adapter into the tenant's CRM store. */
export async function importContacts(db: Db, ctx: TenantContext, adapter: CrmAdapter, meta: { fileName?: string | null; now?: Date } = {}): Promise<ImportSummary> {
  const now = meta.now ?? new Date();
  const imp = await db.crmImport.create({ data: { agencyId: ctx.agencyId, userId: ctx.userId, adapter: adapter.key, fileName: meta.fileName ?? null, status: "PROCESSING", startedAt: now } });
  const summary: ImportSummary = { importId: imp.id, totalRows: 0, created: 0, updated: 0, duplicates: 0, conflicts: 0, invalid: 0 };
  try {
    const inputs = await adapter.importContacts();
    summary.totalRows = inputs.length;
    const users = await db.user.findMany({ where: { agencyId: ctx.agencyId, isActive: true }, select: { id: true, name: true, email: true } });
    const seenInFile = new Set<string>();
    let rowNumber = 0;
    for (const input of inputs) {
      rowNumber++;
      await importOne(db, ctx, imp.id, rowNumber, input, users, seenInFile, summary);
    }
    await db.crmImport.update({ where: { id: imp.id }, data: { status: "COMPLETED", finishedAt: new Date(), totalRows: summary.totalRows, createdCount: summary.created, updatedCount: summary.updated, duplicateCount: summary.duplicates, conflictCount: summary.conflicts, invalidCount: summary.invalid } });
    await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "crm.import.completed", entityType: "CrmImport", entityId: imp.id, metadata: { ...summary } });
    log.info("import completed", { agencyId: ctx.agencyId, ...summary });
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.crmImport.update({ where: { id: imp.id }, data: { status: "FAILED", finishedAt: new Date(), errorMessage: message.slice(0, 500) } });
    await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "crm.import.failed", entityType: "CrmImport", entityId: imp.id });
    throw err;
  }
}

export async function importCsv(db: Db, ctx: TenantContext, csv: string, fileName?: string | null, now?: Date): Promise<ImportSummary> {
  return importContacts(db, ctx, new CsvCrmAdapter(csv), { fileName, now });
}

async function importOne(db: Db, ctx: TenantContext, importId: string, rowNumber: number, input: CrmContactInput, users: Array<{ id: string; name: string; email: string }>, seenInFile: Set<string>, summary: ImportSummary): Promise<void> {
  const n = normalizeContact(input);
  const raw = input.sourceValues as Prisma.InputJsonValue;
  if (!n.isValid) {
    summary.invalid++;
    await db.crmImportRow.create({ data: { importId, agencyId: ctx.agencyId, rowNumber, status: "INVALID", message: n.validationMessage, rawData: raw } });
    return;
  }
  if (seenInFile.has(n.dedupeKey)) {
    summary.duplicates++;
    await db.crmImportRow.create({ data: { importId, agencyId: ctx.agencyId, rowNumber, status: "DUPLICATE", message: "Duplicate row within the same file", rawData: raw } });
    return;
  }
  seenInFile.add(n.dedupeKey);
  const assignedUserId = resolveAgentUserId(input.assignedAgent, users);

  // Find an existing contact by primary key, then by secondary identity keys — always inside the tenant.
  const or: Prisma.CrmContactWhereInput[] = [{ dedupeKey: n.dedupeKey }];
  if (input.externalContactId) or.push({ externalContactId: input.externalContactId.trim() });
  if (n.normalizedPhone) or.push({ normalizedPhone: n.normalizedPhone });
  if (n.normalizedEmail) or.push({ normalizedEmail: n.normalizedEmail });
  const existing = await db.crmContact.findFirst({ where: { agencyId: ctx.agencyId, deletedAt: null, OR: or }, orderBy: { createdAt: "asc" } });

  let contactId: string;
  if (existing) {
    const plan = planMerge(existing, input);
    const fill = plan.fill;
    const data: Prisma.CrmContactUpdateInput = {};
    if (fill.firstName !== undefined) data.firstName = String(fill.firstName);
    if (fill.lastName !== undefined) data.lastName = String(fill.lastName);
    if (fill.email !== undefined) { data.email = String(fill.email); data.normalizedEmail = n.normalizedEmail; }
    if (fill.phone !== undefined) { data.phone = String(fill.phone); data.normalizedPhone = n.normalizedPhone; }
    if (fill.address !== undefined) { data.address = String(fill.address); data.normalizedAddressKey = n.normalizedAddressKey; }
    if (fill.postalCode !== undefined) data.postalCode = String(fill.postalCode);
    if (fill.city !== undefined) data.city = n.city;
    if (fill.contactType !== undefined) data.contactType = input.contactType;
    if (fill.status !== undefined) data.status = input.status;
    if (fill.assignedAgent !== undefined) { data.assignedAgentName = String(fill.assignedAgent); if (assignedUserId) data.assignedUser = { connect: { id: assignedUserId } }; }
    if (fill.notes !== undefined) data.notes = String(fill.notes);
    if (fill.lastContactAt !== undefined) data.lastContactAt = fill.lastContactAt as Date;
    if (!existing.normalizedName && n.normalizedName) data.normalizedName = n.normalizedName;
    if (!existing.externalContactId && input.externalContactId) data.externalContactId = input.externalContactId.trim();
    if (!existing.crmCreatedAt && input.createdAt) data.crmCreatedAt = input.createdAt;
    if (!existing.assignedUserId && assignedUserId) data.assignedUser = { connect: { id: assignedUserId } };
    const hasFill = Object.keys(data).length > 0;
    if (hasFill) await db.crmContact.update({ where: { id: existing.id }, data });
    contactId = existing.id;
    if (plan.conflicts.length) {
      summary.conflicts++;
      await db.crmImportRow.create({ data: { importId, agencyId: ctx.agencyId, rowNumber, status: "CONFLICT", contactId, message: `${plan.conflicts.length} field(s) differ from the existing contact and were NOT overwritten: ${plan.conflicts.map((c) => c.field).join(", ")}`, rawData: raw, conflicts: plan.conflicts as unknown as Prisma.InputJsonValue } });
    } else if (hasFill) {
      summary.updated++;
      await db.crmImportRow.create({ data: { importId, agencyId: ctx.agencyId, rowNumber, status: "UPDATED", contactId, message: `Enriched: ${Object.keys(fill).join(", ")}`, rawData: raw } });
    } else {
      summary.duplicates++;
      await db.crmImportRow.create({ data: { importId, agencyId: ctx.agencyId, rowNumber, status: "DUPLICATE", contactId, message: "Contact already exists with identical data", rawData: raw } });
    }
  } else {
    const created = await db.crmContact.create({
      data: {
        agencyId: ctx.agencyId,
        externalContactId: input.externalContactId?.trim() ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        normalizedName: n.normalizedName,
        email: input.email,
        normalizedEmail: n.normalizedEmail,
        phone: input.phone,
        normalizedPhone: n.normalizedPhone,
        address: input.address,
        normalizedAddressKey: n.normalizedAddressKey,
        postalCode: n.postalCode,
        city: n.city,
        assignedAgentName: input.assignedAgent,
        assignedUserId,
        contactType: input.contactType,
        leadType: input.leadType,
        status: input.status,
        crmCreatedAt: input.createdAt,
        lastContactAt: input.lastContactAt,
        notes: input.notes,
        dedupeKey: n.dedupeKey,
        importId,
        sourceValues: raw,
      },
    });
    contactId = created.id;
    summary.created++;
    await db.crmImportRow.create({ data: { importId, agencyId: ctx.agencyId, rowNumber, status: "CREATED", contactId, rawData: raw } });
    if (input.lastContactAt) {
      await db.crmInteraction.create({ data: { agencyId: ctx.agencyId, contactId, type: "IMPORT", occurredAt: input.lastContactAt, summary: "Last contact date from CRM import", importId } });
    }
  }

  // Property relationship (hint from CSV) → graph edge, linked to a shared Property when the address is known.
  if (input.propertyRelationship) {
    const rel = input.propertyRelationship;
    const addr = normalizeAddress({ address: rel.address, postalCode: rel.postalCode });
    const addressKey = addr.addressKey;
    const already = await db.contactPropertyRelationship.findFirst({ where: { agencyId: ctx.agencyId, contactId, relationshipType: rel.type, addressKey: addressKey ?? undefined, year: rel.year ?? undefined } });
    if (!already) {
      const property = addressKey ? await db.property.findFirst({ where: { normalizedAddressKey: addressKey } }) : null;
      await db.contactPropertyRelationship.create({ data: { agencyId: ctx.agencyId, contactId, propertyId: property?.id ?? null, addressKey, postalCode: addr.postalCode ?? rel.postalCode, relationshipType: rel.type, year: rel.year, source: "csv-import", note: rel.address } });
    }
  }
}

/** Re-link relationship rows that have an address key but no property yet (run after ingestion). */
export async function linkRelationshipsToProperties(db: Db): Promise<number> {
  const pending = await db.contactPropertyRelationship.findMany({ where: { propertyId: null, addressKey: { not: null } }, select: { id: true, addressKey: true } });
  let linked = 0;
  for (const r of pending) {
    const property = await db.property.findFirst({ where: { normalizedAddressKey: r.addressKey }, select: { id: true } });
    if (property) {
      await db.contactPropertyRelationship.update({ where: { id: r.id }, data: { propertyId: property.id } });
      linked++;
    }
  }
  return linked;
}
