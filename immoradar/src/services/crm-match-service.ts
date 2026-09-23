import type { Db } from "@/lib/db";
import type { CrmMatchResult } from "@/domain/contact/types";
import { matchCrmContact, type CrmCandidate, type MarketSubject } from "@/crm/crm-matcher";

/**
 * Search ONE agency's CRM for a relationship with a market signal.
 * The agencyId filter is applied in every query: CRM data never crosses tenants.
 */
export async function findCrmMatch(db: Db, agencyId: string, subject: MarketSubject): Promise<CrmMatchResult> {
  const or: Array<Record<string, unknown>> = [];
  if (subject.sellerPhone) or.push({ normalizedPhone: subject.sellerPhone });
  if (subject.sellerEmail) or.push({ normalizedEmail: subject.sellerEmail });
  if (subject.addressKey) or.push({ normalizedAddressKey: subject.addressKey });
  if (subject.addressKey) or.push({ relationships: { some: { agencyId, addressKey: subject.addressKey } } });
  if (subject.propertyId) or.push({ relationships: { some: { agencyId, propertyId: subject.propertyId } } });
  if (subject.sellerNormalizedName) or.push({ normalizedName: subject.sellerNormalizedName });
  if (!or.length) return { crmMatch: false, confidence: 0, contactId: null, reasons: [] };

  const contacts = await db.crmContact.findMany({
    where: { agencyId, deletedAt: null, OR: or },
    include: { relationships: { where: { agencyId }, select: { addressKey: true, propertyId: true } } },
    take: 50,
  });
  const candidates: CrmCandidate[] = contacts.map((c) => ({
    contactId: c.id,
    normalizedPhone: c.normalizedPhone,
    normalizedEmail: c.normalizedEmail,
    normalizedName: c.normalizedName,
    normalizedAddressKey: c.normalizedAddressKey,
    postalCode: c.postalCode,
    relationshipAddressKeys: c.relationships.map((r) => r.addressKey).filter((k): k is string => !!k),
    relationshipPropertyIds: c.relationships.map((r) => r.propertyId).filter((k): k is string => !!k),
  }));
  return matchCrmContact(subject, candidates);
}
