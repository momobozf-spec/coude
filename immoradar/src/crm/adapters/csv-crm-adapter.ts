import type { CrmContactStatus, CrmContactType } from "@/generated/prisma/enums";
import type { CrmContactInput } from "@/domain/contact/types";
import { foldText, normalizePostalCode, normalizeTimestamp } from "@/normalization/normalizers";
import { parseCsv } from "../csv/parse-csv";
import type { CrmAdapter } from "./crm-adapter";

/**
 * Column aliases: the CSV export of most Belgian CRMs can be mapped without
 * manual configuration. Keys are canonical field names; values are accepted
 * header names (case/accents/underscores insensitive).
 */
export const CSV_COLUMN_ALIASES: Record<string, string[]> = {
  externalContactId: ["externalContactId", "external_contact_id", "contact_id", "contactid", "id", "crm_id", "ref", "reference"],
  firstName: ["firstName", "first_name", "voornaam", "prenom", "prénom", "given name"],
  lastName: ["lastName", "last_name", "naam", "achternaam", "familienaam", "nom", "surname", "family name"],
  fullName: ["name", "full name", "fullname", "contact", "volledige naam"],
  email: ["email", "e-mail", "mail", "emailaddress", "e-mailadres"],
  phone: ["phone", "telefoon", "tel", "gsm", "mobile", "mobiel", "telephone", "téléphone", "phone number"],
  address: ["address", "adres", "adresse", "street", "straat", "rue"],
  postalCode: ["postalCode", "postal_code", "postcode", "zip", "zipcode", "code postal", "cp"],
  city: ["city", "gemeente", "stad", "ville", "commune", "municipality"],
  assignedAgent: ["assignedAgent", "assigned_agent", "agent", "makelaar", "owner", "verantwoordelijke", "responsable", "user"],
  contactType: ["contactType", "contact_type", "type", "categorie", "category", "rol", "role"],
  leadType: ["leadType", "lead_type", "lead", "subtype"],
  status: ["status", "statut", "stage", "fase"],
  createdAt: ["createdAt", "created_at", "created", "aangemaakt", "date created", "creation date", "date de création"],
  lastContactAt: ["lastContactAt", "last_contact_at", "last contact", "laatste contact", "last_contact", "dernier contact", "last activity", "laatste activiteit"],
  notes: ["notes", "note", "opmerkingen", "remarques", "comments", "commentaar"],
  relationshipType: ["relationshipType", "relationship_type", "relation", "relatie", "property_relationship"],
  relationshipYear: ["relationshipYear", "relationship_year", "year", "jaar", "année", "transaction_year"],
  relationshipAddress: ["propertyAddress", "property_address", "pand", "pand adres", "bien", "property"],
  relationshipPostalCode: ["propertyPostalCode", "property_postal_code", "pand postcode", "property zip"],
};

const normHeader = (h: string) => (foldText(h) ?? "").replace(/[\s_-]+/g, "");

export function buildColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => [h, normHeader(h)] as const);
  for (const [field, aliases] of Object.entries(CSV_COLUMN_ALIASES)) {
    const aliasSet = new Set(aliases.map(normHeader));
    const hit = normalizedHeaders.find(([, n]) => aliasSet.has(n));
    if (hit) map[field] = hit[0];
  }
  return map;
}

export function mapContactType(value: string | undefined): CrmContactType {
  const s = foldText(value) ?? "";
  if (!s) return "UNKNOWN";
  if (/valuation|schatting|waardebepaling|estimation|taxatie/.test(s)) return "VALUATION_LEAD";
  if (/former|oud|ancien|ex-?client|voormalig/.test(s)) return "FORMER_CLIENT";
  if (/landlord|verhuurder|bailleur|eigenaar-verhuurder/.test(s)) return "LANDLORD";
  if (/tenant|huurder|locataire/.test(s)) return "TENANT";
  // "verkoper" (seller) contains "koper" (buyer): test seller patterns first.
  if (/seller|verkoper|vendeur|eigenaar|owner/.test(s)) return "SELLER";
  if (/buyer|koper|acheteur/.test(s)) return "BUYER";
  if (/prospect|lead|suspect/.test(s)) return "PROSPECT";
  return "UNKNOWN";
}

export function mapStatus(value: string | undefined): CrmContactStatus {
  const s = foldText(value) ?? "";
  if (!s) return "UNKNOWN";
  if (/lost|verloren|perdu|niet gewonnen|no mandate|geen mandaat/.test(s)) return "LOST";
  if (/won|gewonnen|gagne|sold|verkocht|vendu|bought|gekocht|achete|mandate|mandaat/.test(s)) return "WON";
  if (/closed|gesloten|ferme|archived|gearchiveerd/.test(s)) return "CLOSED";
  if (/inactive|inactief|dormant|slapend/.test(s)) return "INACTIVE";
  if (/active|actief|open|new|nieuw|in progress|lopend|hot|warm|cold/.test(s)) return "ACTIVE";
  return "UNKNOWN";
}

function mapRelationshipType(value: string | undefined): NonNullable<CrmContactInput["propertyRelationship"]>["type"] | null {
  const s = foldText(value) ?? "";
  if (!s) return null;
  if (/sold|verkocht|vendu|seller|verkoper/.test(s)) return "SOLD";
  if (/bought|gekocht|achete|buyer|koper/.test(s)) return "BOUGHT";
  if (/valuation|schatting|estimation|waardebepaling/.test(s)) return "VALUATION_REQUESTED";
  if (/owner|eigenaar|proprietaire/.test(s)) return "OWNER";
  if (/tenant|huurder|locataire/.test(s)) return "TENANT";
  if (/landlord|verhuurder|bailleur/.test(s)) return "LANDLORD";
  if (/interest|interesse|interesse/.test(s)) return "INTERESTED";
  return null;
}

const blank = (v: string | undefined): string | null => (v && v.trim().length ? v.trim() : null);

export function rowToContactInput(row: Record<string, string>, columns: Record<string, string>): CrmContactInput {
  const get = (field: string): string | undefined => {
    const col = columns[field];
    return col ? row[col] : undefined;
  };
  let firstName = blank(get("firstName"));
  let lastName = blank(get("lastName"));
  const fullName = blank(get("fullName"));
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/);
    if (parts.length === 1) lastName = parts[0] ?? null;
    else {
      firstName = parts[0] ?? null;
      lastName = parts.slice(1).join(" ");
    }
  }
  const relType = mapRelationshipType(get("relationshipType"));
  const relYearRaw = blank(get("relationshipYear"));
  const relYear = relYearRaw && /^\d{4}$/.test(relYearRaw) ? Number(relYearRaw) : null;
  const relAddress = blank(get("relationshipAddress"));
  const relPostal = normalizePostalCode(get("relationshipPostalCode") ?? null);

  return {
    externalContactId: blank(get("externalContactId")),
    firstName,
    lastName,
    email: blank(get("email")),
    phone: blank(get("phone")),
    address: blank(get("address")),
    postalCode: normalizePostalCode(get("postalCode") ?? null) ?? relPostal,
    city: blank(get("city")),
    assignedAgent: blank(get("assignedAgent")),
    contactType: mapContactType(get("contactType")),
    leadType: blank(get("leadType")),
    status: mapStatus(get("status")),
    createdAt: normalizeTimestamp(get("createdAt")),
    lastContactAt: normalizeTimestamp(get("lastContactAt")),
    notes: blank(get("notes")),
    propertyRelationship:
      relType || relAddress
        ? { type: relType ?? "OWNER", year: relYear, address: relAddress ?? blank(get("address")), postalCode: relPostal ?? normalizePostalCode(get("postalCode") ?? null) }
        : null,
    sourceValues: { ...row },
  };
}

export class CsvCrmAdapter implements CrmAdapter {
  readonly key = "csv";
  readonly name = "CSV import";
  private readonly csv: string;

  constructor(csvContent: string) {
    this.csv = csvContent;
  }

  async importContacts(): Promise<CrmContactInput[]> {
    const parsed = parseCsv(this.csv);
    const columns = buildColumnMap(parsed.headers);
    return parsed.rows.map((row) => rowToContactInput(row, columns));
  }

  /** Expose the detected mapping for UI feedback. */
  static inspect(csvContent: string): { headers: string[]; columns: Record<string, string>; rowCount: number } {
    const parsed = parseCsv(csvContent);
    return { headers: parsed.headers, columns: buildColumnMap(parsed.headers), rowCount: parsed.rows.length };
  }
}
