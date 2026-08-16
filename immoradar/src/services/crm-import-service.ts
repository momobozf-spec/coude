/**
 * CRM CSV import service: parses, normalizes, deduplicates and persists an
 * uploaded contact export with full per-row provenance. CRM data is never
 * silently overwritten (see src/crm/dedupe.ts).
 */

import { parseCrmCsv } from "@/crm/csv-adapter";
import { buildContactUpdate, decideDedupe, type ExistingContactKey } from "@/crm/dedupe";
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { tenantDb } from "@/repositories/tenant-db";

export interface ImportSummary {
  importId: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
}

export class CrmImportService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async importCsv(
    agencyId: string,
    uploadedById: string | null,
    fileName: string,
    csvContent: string,
  ): Promise<ImportSummary> {
    const tenant = tenantDb(agencyId, this.db);
    const { results } = parseCrmCsv(csvContent);

    const importRecord = await this.db.crmImport.create({
      data: {
        agencyId,
        uploadedById,
        fileName,
        adapter: "csv",
        status: "PROCESSING",
        totalRows: results.length,
      },
    });

    const summary: ImportSummary = {
      importId: importRecord.id,
      totalRows: results.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    // Agency users by name for assigned-agent mapping
    const agencyUsers = await tenant.agencyUsers();
    const usersByName = new Map<string, string>();
    for (const user of agencyUsers) {
      usersByName.set(`${user.firstName} ${user.lastName}`.toLowerCase(), user.id);
      usersByName.set(user.firstName.toLowerCase(), user.id);
    }

    for (const row of results) {
      let outcome: "CREATED" | "UPDATED" | "SKIPPED_DUPLICATE" | "SKIPPED_CONFLICT" | "ERROR";
      let message: string | null = row.error;
      let contactId: string | null = null;

      if (!row.contact) {
        outcome = "ERROR";
        summary.errors++;
      } else {
        try {
          const incoming = row.contact;
          // Candidate set: any contact in THIS agency sharing a match key
          const or: Prisma.CrmContactWhereInput[] = [];
          if (incoming.externalContactId) or.push({ externalContactId: incoming.externalContactId });
          if (incoming.normalizedEmail) or.push({ normalizedEmail: incoming.normalizedEmail });
          if (incoming.normalizedPhone) or.push({ normalizedPhone: incoming.normalizedPhone });
          if (incoming.normalizedName && incoming.postalCode) {
            or.push({ normalizedName: incoming.normalizedName, postalCode: incoming.postalCode });
          }
          const existing = or.length
            ? await tenant.crmContacts({
                where: { OR: or },
                select: {
                  id: true,
                  externalContactId: true,
                  normalizedEmail: true,
                  normalizedPhone: true,
                  normalizedName: true,
                  postalCode: true,
                } as Prisma.CrmContactSelect,
                take: 20,
              })
            : [];

          const decision = decideDedupe(incoming, existing as unknown as ExistingContactKey[]);

          const assignedAgentId = incoming.assignedAgentName
            ? usersByName.get(incoming.assignedAgentName.toLowerCase()) ?? null
            : null;

          if (decision.action === "CREATE") {
            const created = await tenant.createCrmContact({
              externalContactId: incoming.externalContactId,
              firstName: incoming.firstName,
              lastName: incoming.lastName,
              normalizedName: incoming.normalizedName,
              email: incoming.email,
              normalizedEmail: incoming.normalizedEmail,
              phone: incoming.phone,
              normalizedPhone: incoming.normalizedPhone,
              address: incoming.address,
              postalCode: incoming.postalCode,
              city: incoming.city,
              assignedAgentId,
              assignedAgentName: incoming.assignedAgentName,
              contactType: incoming.contactType,
              leadType: incoming.leadType,
              status: incoming.status,
              sourceCreatedAt: incoming.sourceCreatedAt,
              lastContactAt: incoming.lastContactAt,
              notes: incoming.notes,
            });
            contactId = created.id;
            outcome = "CREATED";
            summary.imported++;
          } else if (decision.action === "UPDATE") {
            const current = await tenant.crmContactById(decision.contactId);
            if (!current) throw new Error("Matched contact disappeared");
            const patch = buildContactUpdate(current, incoming);
            if (Object.keys(patch).length > 0) {
              await tenant.updateCrmContact(decision.contactId, patch as Prisma.CrmContactUncheckedUpdateInput);
            }
            contactId = decision.contactId;
            outcome = "UPDATED";
            message = `Matched on ${decision.matchedOn}`;
            summary.updated++;
          } else if (decision.action === "SKIP_DUPLICATE") {
            contactId = decision.contactId;
            outcome = "SKIPPED_DUPLICATE";
            message = `Duplicate of existing contact (${decision.matchedOn})`;
            summary.skipped++;
          } else {
            contactId = decision.contactId;
            outcome = "SKIPPED_CONFLICT";
            message = decision.reason;
            summary.skipped++;
          }
        } catch (err) {
          outcome = "ERROR";
          message = err instanceof Error ? err.message : "Unknown import error";
          summary.errors++;
        }
      }

      await this.db.crmImportRow.create({
        data: {
          importId: importRecord.id,
          rowNumber: row.rowNumber,
          rawData: row.raw as Prisma.InputJsonValue,
          outcome,
          message,
          contactId,
        },
      });
    }

    await this.db.crmImport.update({
      where: { id: importRecord.id },
      data: {
        status: "COMPLETED",
        importedRows: summary.imported,
        updatedRows: summary.updated,
        skippedRows: summary.skipped,
        errorRows: summary.errors,
        finishedAt: new Date(),
      },
    });

    await this.db.auditLog.create({
      data: {
        agencyId,
        userId: uploadedById,
        action: "CRM_IMPORT",
        entity: "CrmImport",
        entityId: importRecord.id,
        metadata: {
          fileName,
          totalRows: summary.totalRows,
          imported: summary.imported,
          updated: summary.updated,
          skipped: summary.skipped,
          errors: summary.errors,
        } as Prisma.InputJsonValue,
      },
    });

    logger.info("crm.import.completed", { agencyId, ...summary });
    return summary;
  }
}
