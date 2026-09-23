import type { CrmContactType, PropertyRelationshipType } from "@/generated/prisma/enums";

interface ContactLike {
  contactType: CrmContactType;
  status: string;
  relationships?: Array<{ relationshipType: PropertyRelationshipType; year: number | null }>;
}

/** Human label such as "Previous buyer — 2019". */
export function relationshipLabelFor(c: ContactLike): string {
  const rels = c.relationships ?? [];
  const year = (types: PropertyRelationshipType[]): number | undefined => rels.find((r) => types.includes(r.relationshipType) && r.year)?.year ?? undefined;
  const suffix = (y: number | undefined) => (y ? ` — ${y}` : "");
  if (c.contactType === "BUYER" || rels.some((r) => r.relationshipType === "BOUGHT")) return `Previous buyer${suffix(year(["BOUGHT"]))}`;
  if (c.contactType === "VALUATION_LEAD" || rels.some((r) => r.relationshipType === "VALUATION_REQUESTED")) return `Valuation request${suffix(year(["VALUATION_REQUESTED"]))}`;
  if (c.contactType === "SELLER") return c.status === "LOST" ? `Lost seller mandate${suffix(year(["SOLD"]))}` : `Previous seller${suffix(year(["SOLD"]))}`;
  if (c.contactType === "FORMER_CLIENT") return "Former client";
  if (c.contactType === "LANDLORD") return "Landlord";
  if (c.contactType === "TENANT") return "Tenant";
  if (c.contactType === "PROSPECT") return "Prospect";
  return "Known contact";
}

export function contactDisplayName(c: { firstName: string | null; lastName: string | null }): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed contact";
}
