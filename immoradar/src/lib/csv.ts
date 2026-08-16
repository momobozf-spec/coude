/**
 * Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
 * Kept dependency-free and fully unit-tested. Supports `,` and `;`
 * delimiters (Belgian CRM exports frequently use `;`).
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function detectDelimiter(firstLine: string): "," | ";" {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(input: string, delimiter?: "," | ";"): CsvParseResult {
  const text = input.replace(/^﻿/, ""); // strip BOM
  if (text.trim() === "") return { headers: [], rows: [] };

  const firstNewline = text.indexOf("\n");
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline);
  const delim = delimiter ?? detectDelimiter(firstLine);

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    // Skip fully empty records (trailing newlines)
    if (record.length === 1 && record[0] === "") {
      record = [];
      return;
    }
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || record.length > 0) {
    pushField();
    pushRecord();
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0]!.map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (const rec of records.slice(1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (header === "") return;
      row[header] = (rec[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}
