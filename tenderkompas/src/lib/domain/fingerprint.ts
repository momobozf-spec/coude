import { createHash } from "node:crypto";

/** Stabiele JSON-serialisatie (gesorteerde sleutels) voor hashing. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Vingerafdruk van alle beoordelingsrelevante gegevens van een procedure.
 * Elke wijziging (deadline, waarde, voorwaarde, perceel, status, document) ⇒ andere vingerafdruk ⇒ hercontrole.
 */
export function procedureFingerprint(input: {
  lifecycle: string;
  summary?: string | null;
  core?: Record<string, unknown>;
  lots: { lotKey: string; title: string | null; cpvCodes: string[] }[];
  facts: {
    key: string;
    lotKey: string | null;
    rawValue: string;
    valueNumber: string | number | null;
    unit: string | null;
    valueInstant: Date | string | null;
    valueDate: string | null;
    verificationStatus: string;
  }[];
  requirements: {
    kind: string;
    category: string;
    lotKey: string | null;
    text: string;
    mandatory: boolean | null;
    consortiumBasis: string;
    verificationStatus: string;
  }[];
  documents: { sha256: string; textStatus: string }[];
}): string {
  const norm = {
    lifecycle: input.lifecycle,
    summary: input.summary ?? null,
    core: input.core ?? null,
    lots: [...input.lots].map((l) => ({ ...l, cpvCodes: [...l.cpvCodes].sort() })).sort((a, b) => a.lotKey.localeCompare(b.lotKey)),
    facts: input.facts
      .map((f) => ({
        ...f,
        valueNumber: f.valueNumber === null ? null : Number(f.valueNumber),
        valueInstant: f.valueInstant ? new Date(f.valueInstant).toISOString() : null,
      }))
      .map(stableStringify)
      .sort(),
    requirements: input.requirements.map(stableStringify).sort(),
    documents: input.documents.map(stableStringify).sort(),
  };
  return sha256(stableStringify(norm));
}
