/**
 * Normalizes an imported CRM row (arbitrary header names) into a
 * NormalizedCrmContact. Recognizes common Dutch/French/English header
 * variants so agencies can upload exports from different CRMs.
 */

import type { ContactStatus, ContactType, NormalizedCrmContact } from "@/domain/contact/types";
import { CONTACT_STATUSES, CONTACT_TYPES } from "@/domain/contact/types";
import {
  normalizeCity,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  normalizePostalCode,
  normalizeTimestamp,
} from "@/normalization/normalizers";

const HEADER_ALIASES: Record<string, string[]> = {
  externalContactId: ["externalcontactid", "external_id", "externalid", "contact_id", "contactid", "id", "klantnummer"],
  firstName: ["firstname", "first_name", "voornaam", "prenom", "prénom"],
  lastName: ["lastname", "last_name", "achternaam", "naam", "nom", "familienaam"],
  email: ["email", "e-mail", "emailadres", "courriel", "mail"],
  phone: ["phone", "telefoon", "gsm", "tel", "telephone", "téléphone", "mobile", "telefoonnummer"],
  address: ["address", "adres", "adresse", "straat", "street"],
  postalCode: ["postalcode", "postal_code", "postcode", "zip", "zipcode", "code_postal", "codepostal"],
  city: ["city", "stad", "gemeente", "ville", "plaats", "woonplaats"],
  assignedAgent: ["assignedagent", "assigned_agent", "agent", "makelaar", "beheerder", "verantwoordelijke"],
  contactType: ["contacttype", "contact_type", "type", "type_contact"],
  leadType: ["leadtype", "lead_type"],
  status: ["status", "statut", "staat"],
  createdAt: ["createdat", "created_at", "created", "aangemaakt", "datum", "date_created"],
  lastContactAt: ["lastcontactat", "last_contact_at", "lastcontact", "last_contact", "laatste_contact", "laatstcontact", "dernier_contact"],
  notes: ["notes", "notitie", "notities", "opmerkingen", "remarques", "commentaire"],
};

function buildHeaderIndex(row: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>();
  for (const key of Object.keys(row)) {
    const cleaned = key.toLowerCase().replace(/[\s.]/g, "");
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(cleaned) && !index.has(canonical)) {
        index.set(canonical, key);
      }
    }
  }
  return index;
}

const CONTACT_TYPE_ALIASES: Record<string, ContactType> = {
  koper: "BUYER",
  acheteur: "BUYER",
  buyer: "BUYER",
  verkoper: "SELLER",
  vendeur: "SELLER",
  seller: "SELLER",
  verhuurder: "LANDLORD",
  eigenaar: "LANDLORD",
  landlord: "LANDLORD",
  huurder: "TENANT",
  locataire: "TENANT",
  tenant: "TENANT",
  schatting: "VALUATION_LEAD",
  waardebepaling: "VALUATION_LEAD",
  estimation: "VALUATION_LEAD",
  valuation: "VALUATION_LEAD",
  valuation_lead: "VALUATION_LEAD",
  valuationlead: "VALUATION_LEAD",
  prospect: "PROSPECT",
  lead: "PROSPECT",
  "oud-klant": "FORMER_CLIENT",
  oudklant: "FORMER_CLIENT",
  former_client: "FORMER_CLIENT",
  formerclient: "FORMER_CLIENT",
  "ancien client": "FORMER_CLIENT",
};

export function normalizeContactType(raw: string | null | undefined): ContactType {
  if (!raw) return "UNKNOWN";
  const key = raw.trim().toLowerCase();
  const upper = raw.trim().toUpperCase() as ContactType;
  if ((CONTACT_TYPES as readonly string[]).includes(upper)) return upper;
  return CONTACT_TYPE_ALIASES[key] ?? "UNKNOWN";
}

const STATUS_ALIASES: Record<string, ContactStatus> = {
  actief: "ACTIVE",
  active: "ACTIVE",
  actif: "ACTIVE",
  open: "ACTIVE",
  slapend: "DORMANT",
  dormant: "DORMANT",
  inactief: "DORMANT",
  inactive: "DORMANT",
  verloren: "LOST",
  lost: "LOST",
  perdu: "LOST",
  gewonnen: "WON",
  won: "WON",
  gagne: "WON",
  "gagné": "WON",
  gearchiveerd: "ARCHIVED",
  archived: "ARCHIVED",
  archief: "ARCHIVED",
};

export function normalizeContactStatus(raw: string | null | undefined): ContactStatus {
  if (!raw) return "UNKNOWN";
  const key = raw.trim().toLowerCase();
  const upper = raw.trim().toUpperCase() as ContactStatus;
  if ((CONTACT_STATUSES as readonly string[]).includes(upper)) return upper;
  return STATUS_ALIASES[key] ?? "UNKNOWN";
}

export function normalizeCrmRow(row: Record<string, string>): NormalizedCrmContact {
  const index = buildHeaderIndex(row);
  const get = (canonical: string): string | null => {
    const header = index.get(canonical);
    if (!header) return null;
    const value = row[header]?.trim();
    return value ? value : null;
  };

  const firstName = get("firstName");
  const lastName = get("lastName");
  const email = get("email");
  const phone = get("phone");

  return {
    externalContactId: get("externalContactId"),
    firstName,
    lastName,
    normalizedName: normalizePersonName(firstName, lastName),
    email,
    normalizedEmail: normalizeEmail(email),
    phone,
    normalizedPhone: normalizePhone(phone),
    address: get("address"),
    postalCode: normalizePostalCode(get("postalCode")),
    city: normalizeCity(get("city")),
    assignedAgentName: get("assignedAgent"),
    contactType: normalizeContactType(get("contactType")),
    leadType: get("leadType"),
    status: normalizeContactStatus(get("status")),
    sourceCreatedAt: normalizeTimestamp(get("createdAt")),
    lastContactAt: normalizeTimestamp(get("lastContactAt")),
    notes: get("notes"),
  };
}
