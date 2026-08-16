/**
 * CRM import deduplication. Decides, for an incoming normalized contact,
 * whether it is new, an update to an existing contact, or a duplicate/conflict.
 * CRM data is never silently overwritten: updates only fill empty fields or
 * refresh clearly-newer values; conflicting identity data is flagged.
 */

import type { NormalizedCrmContact } from "@/domain/contact/types";

export interface ExistingContactKey {
  id: string;
  externalContactId: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  normalizedName: string | null;
  postalCode: string | null;
}

export type DedupeDecision =
  | { action: "CREATE" }
  | { action: "UPDATE"; contactId: string; matchedOn: string }
  | { action: "SKIP_DUPLICATE"; contactId: string; matchedOn: string }
  | { action: "CONFLICT"; contactId: string; reason: string };

export function decideDedupe(
  incoming: NormalizedCrmContact,
  existing: ExistingContactKey[],
): DedupeDecision {
  // 1. External ID is authoritative within an agency
  if (incoming.externalContactId) {
    const byId = existing.find((e) => e.externalContactId === incoming.externalContactId);
    if (byId) {
      // Same external id but contradictory identity → conflict, never overwrite
      const emailConflict =
        incoming.normalizedEmail && byId.normalizedEmail &&
        incoming.normalizedEmail !== byId.normalizedEmail;
      const phoneConflict =
        incoming.normalizedPhone && byId.normalizedPhone &&
        incoming.normalizedPhone !== byId.normalizedPhone;
      if (emailConflict && phoneConflict) {
        return {
          action: "CONFLICT",
          contactId: byId.id,
          reason: "Same external ID but different email AND phone",
        };
      }
      return { action: "UPDATE", contactId: byId.id, matchedOn: "externalContactId" };
    }
  }

  // 2. Exact email match
  if (incoming.normalizedEmail) {
    const byEmail = existing.find((e) => e.normalizedEmail === incoming.normalizedEmail);
    if (byEmail) return { action: "UPDATE", contactId: byEmail.id, matchedOn: "email" };
  }

  // 3. Exact phone match
  if (incoming.normalizedPhone) {
    const byPhone = existing.find((e) => e.normalizedPhone === incoming.normalizedPhone);
    if (byPhone) return { action: "UPDATE", contactId: byPhone.id, matchedOn: "phone" };
  }

  // 4. Name + postal code (weaker): treated as duplicate to skip, not update —
  //    a common name alone must never merge two people.
  if (incoming.normalizedName && incoming.postalCode) {
    const byName = existing.find(
      (e) => e.normalizedName === incoming.normalizedName && e.postalCode === incoming.postalCode,
    );
    if (byName) {
      return { action: "SKIP_DUPLICATE", contactId: byName.id, matchedOn: "name+postalCode" };
    }
  }

  return { action: "CREATE" };
}

/**
 * Merge for UPDATE decisions: incoming values fill gaps; existing non-empty
 * values are preserved unless the incoming row is genuinely newer data
 * (fresher lastContactAt). Returns only fields that should change.
 */
export function buildContactUpdate(
  existing: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    contactType: string;
    leadType: string | null;
    status: string;
    lastContactAt: Date | null;
    notes: string | null;
  },
  incoming: NormalizedCrmContact,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const fill = (key: keyof typeof existing, value: unknown, normalized?: Record<string, unknown>) => {
    if (value !== null && value !== undefined && !existing[key]) {
      patch[key] = value;
      if (normalized) Object.assign(patch, normalized);
    }
  };

  fill("firstName", incoming.firstName);
  fill("lastName", incoming.lastName);
  fill("email", incoming.email, { normalizedEmail: incoming.normalizedEmail });
  fill("phone", incoming.phone, { normalizedPhone: incoming.normalizedPhone });
  fill("address", incoming.address);
  fill("postalCode", incoming.postalCode);
  fill("city", incoming.city);
  fill("leadType", incoming.leadType);
  fill("notes", incoming.notes);

  if (existing.contactType === "UNKNOWN" && incoming.contactType !== "UNKNOWN") {
    patch.contactType = incoming.contactType;
  }
  if (existing.status === "UNKNOWN" && incoming.status !== "UNKNOWN") {
    patch.status = incoming.status;
  }
  const incomingLast = incoming.lastContactAt?.getTime() ?? 0;
  const existingLast = existing.lastContactAt?.getTime() ?? 0;
  if (incomingLast > existingLast) {
    patch.lastContactAt = incoming.lastContactAt;
  }
  return patch;
}
