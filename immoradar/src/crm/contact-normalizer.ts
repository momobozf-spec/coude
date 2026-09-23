import type { CrmContactInput } from "@/domain/contact/types";
import { sha256 } from "@/lib/hash";
import { normalizeAddress, normalizeEmail, normalizePersonName, normalizePhone } from "@/normalization/normalizers";
import { canonicalCityName } from "@/normalization/belgium";

export interface NormalizedContact {
  input: CrmContactInput;
  normalizedName: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  normalizedAddressKey: string | null;
  postalCode: string | null;
  city: string | null;
  dedupeKey: string;
  isValid: boolean;
  validationMessage: string | null;
}

/**
 * Deduplication strategy (in priority order):
 *  1. external CRM id
 *  2. normalized phone
 *  3. normalized email
 *  4. normalized name + postal code
 */
export function normalizeContact(input: CrmContactInput): NormalizedContact {
  const normalizedName = normalizePersonName(input.firstName, input.lastName);
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const address = normalizeAddress({ address: input.address, postalCode: input.postalCode, city: input.city });
  const postalCode = address.postalCode;
  const city = canonicalCityName(input.city) ?? address.city;
  let dedupeKey: string;
  if (input.externalContactId) dedupeKey = `ext:${input.externalContactId.trim().toLowerCase()}`;
  else if (normalizedPhone) dedupeKey = `phone:${normalizedPhone}`;
  else if (normalizedEmail) dedupeKey = `email:${normalizedEmail}`;
  else if (normalizedName && postalCode) dedupeKey = `name:${normalizedName}|${postalCode}`;
  else if (normalizedName) dedupeKey = `name:${normalizedName}`;
  else dedupeKey = `row:${sha256(JSON.stringify(input.sourceValues)).slice(0, 16)}`;

  const isValid = !!(normalizedName || normalizedEmail || normalizedPhone);
  return {
    input,
    normalizedName,
    normalizedEmail,
    normalizedPhone,
    normalizedAddressKey: address.addressKey,
    postalCode,
    city,
    dedupeKey,
    isValid,
    validationMessage: isValid ? null : "Row has no name, email or phone",
  };
}

/** Fields that, when different, indicate a conflict rather than an enrichment. */
export const CONFLICT_FIELDS = ["firstName", "lastName", "email", "phone", "address", "postalCode", "city", "contactType", "status", "assignedAgent", "notes"] as const;

export interface ExistingContactLike {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  contactType: string;
  status: string;
  assignedAgentName: string | null;
  notes: string | null;
  lastContactAt: Date | null;
}

export interface MergePlan {
  /** Fields safe to fill because they were empty before. */
  fill: Partial<Record<(typeof CONFLICT_FIELDS)[number] | "lastContactAt", unknown>>;
  /** Fields that differ from the existing value — never overwritten silently. */
  conflicts: Array<{ field: string; existing: unknown; incoming: unknown }>;
}

/** Compute what may be filled in and what conflicts. CRM data is never silently overwritten. */
export function planMerge(existing: ExistingContactLike, incoming: CrmContactInput): MergePlan {
  const fill: MergePlan["fill"] = {};
  const conflicts: MergePlan["conflicts"] = [];
  const compare = (field: (typeof CONFLICT_FIELDS)[number], existingValue: unknown, incomingValue: unknown, normalize: (v: unknown) => unknown = (v) => v) => {
    const inc = incomingValue === "" ? null : incomingValue;
    if (inc === null || inc === undefined) return;
    if (existingValue === null || existingValue === undefined || existingValue === "" || existingValue === "UNKNOWN") {
      fill[field] = inc;
      return;
    }
    if (normalize(existingValue) !== normalize(inc)) conflicts.push({ field, existing: existingValue, incoming: inc });
  };
  const fold = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);
  compare("firstName", existing.firstName, incoming.firstName, fold);
  compare("lastName", existing.lastName, incoming.lastName, fold);
  compare("email", existing.email, incoming.email, (v) => normalizeEmail(String(v)));
  compare("phone", existing.phone, incoming.phone, (v) => normalizePhone(String(v)));
  compare("address", existing.address, incoming.address, fold);
  compare("postalCode", existing.postalCode, incoming.postalCode);
  compare("city", existing.city, incoming.city, (v) => canonicalCityName(String(v)));
  compare("contactType", existing.contactType, incoming.contactType === "UNKNOWN" ? null : incoming.contactType);
  compare("status", existing.status, incoming.status === "UNKNOWN" ? null : incoming.status);
  compare("assignedAgent", existing.assignedAgentName, incoming.assignedAgent, fold);
  compare("notes", existing.notes, incoming.notes, fold);
  // lastContactAt: newer information is an enrichment, older is ignored (never a conflict).
  if (incoming.lastContactAt && (!existing.lastContactAt || incoming.lastContactAt > existing.lastContactAt)) {
    fill.lastContactAt = incoming.lastContactAt;
  }
  return { fill, conflicts };
}
