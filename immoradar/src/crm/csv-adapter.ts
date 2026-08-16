/** MVP CRM adapter: parses an uploaded CSV export into normalized contacts. */

import type { NormalizedCrmContact } from "@/domain/contact/types";
import { parseCsv } from "@/lib/csv";
import type { CrmAdapter } from "./adapter";
import { normalizeCrmRow } from "./contact-normalizer";

export interface CsvRowResult {
  rowNumber: number; // 1-based data row number
  raw: Record<string, string>;
  contact: NormalizedCrmContact | null;
  error: string | null;
}

/** Parse + normalize each row, keeping per-row provenance for the import log. */
export function parseCrmCsv(content: string): { headers: string[]; results: CsvRowResult[] } {
  const { headers, rows } = parseCsv(content);
  const results: CsvRowResult[] = rows.map((raw, i) => {
    try {
      const contact = normalizeCrmRow(raw);
      const hasIdentity =
        contact.externalContactId ||
        contact.normalizedEmail ||
        contact.normalizedPhone ||
        contact.normalizedName;
      if (!hasIdentity) {
        return { rowNumber: i + 1, raw, contact: null, error: "Row has no identifying fields" };
      }
      return { rowNumber: i + 1, raw, contact, error: null };
    } catch (err) {
      return {
        rowNumber: i + 1,
        raw,
        contact: null,
        error: err instanceof Error ? err.message : "Unknown normalization error",
      };
    }
  });
  return { headers, results };
}

export class CsvCrmAdapter implements CrmAdapter {
  readonly code = "csv";

  constructor(private readonly csvContent: string) {}

  importContacts(): Promise<NormalizedCrmContact[]> {
    const { results } = parseCrmCsv(this.csvContent);
    return Promise.resolve(
      results.filter((r) => r.contact !== null).map((r) => r.contact!),
    );
  }
}
