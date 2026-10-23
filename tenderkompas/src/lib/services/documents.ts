import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { document, procedure } from "@/db/schema";
import { sha256 } from "@/lib/domain/fingerprint";
import { extractText, sniffType, ALLOWED_UPLOAD_TYPES } from "@/lib/documents/text";
import { safeFetch } from "@/lib/net/safe-fetch";
import { audit } from "@/lib/audit";
import { refreshProcedure } from "./procedures";

function storageRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "./storage");
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\- ()]/g, "_").slice(0, 150) || "document";
}

export async function storeDocument(
  database: DB,
  input: { procedureId: string; filename: string; declaredType: string; buffer: Buffer; sourceUrl?: string | null },
  actorUserId: string | null,
) {
  const max = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
  if (input.buffer.length === 0) throw new Error("Leeg bestand.");
  if (input.buffer.length > max) throw new Error(`Bestand te groot (max ${Math.round(max / 1024 / 1024)} MB).`);
  const mime = sniffType(input.buffer, input.declaredType);
  if (!mime) throw new Error("Bestandstype niet toegestaan. Toegestaan: PDF en platte tekst.");
  const proc = await database.query.procedure.findFirst({ where: eq(procedure.id, input.procedureId) });
  if (!proc) throw new Error("Procedure niet gevonden");

  const hash = sha256(input.buffer);
  const dupe = await database.query.document.findFirst({ where: and(eq(document.procedureId, input.procedureId), eq(document.sha256, hash)) });
  if (dupe) return { document: dupe, duplicate: true };

  const filename = safeFilename(input.filename);
  const prev = await database.query.document.findFirst({
    where: and(eq(document.procedureId, input.procedureId), eq(document.filename, filename)),
    orderBy: desc(document.version),
  });
  const ext = ALLOWED_UPLOAD_TYPES[mime];
  const dir = path.join(storageRoot(), "documents", input.procedureId);
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, `${hash}.${ext}`);
  await writeFile(storagePath, input.buffer, { mode: 0o600 });

  const t = await extractText(input.buffer, mime);
  const [row] = await database
    .insert(document)
    .values({
      procedureId: input.procedureId,
      filename,
      sourceUrl: input.sourceUrl ?? null,
      mimeType: mime,
      sizeBytes: input.buffer.length,
      sha256: hash,
      storagePath: path.relative(storageRoot(), storagePath),
      version: (prev?.version ?? 0) + 1,
      textStatus: t.status,
      textStatusDetail: t.detail,
      pageCount: t.pageCount,
      textChars: t.textChars,
      pages: t.pages,
      uploadedByUserId: actorUserId,
    })
    .returning();
  await audit(database, {
    actorUserId,
    action: "document.stored",
    entityType: "procedure",
    entityId: input.procedureId,
    details: { documentId: row.id, textStatus: t.status, sizeBytes: input.buffer.length },
  });
  await refreshProcedure(database, input.procedureId, { actorUserId, reason: `document ${filename} v${row.version}` });
  return { document: row, duplicate: false };
}

export async function fetchDocumentFromUrl(database: DB, input: { procedureId: string; url: string }, actorUserId: string) {
  const res = await safeFetch(input.url);
  const name = decodeURIComponent(new URL(res.finalUrl).pathname.split("/").pop() || "document");
  return storeDocument(
    database,
    { procedureId: input.procedureId, filename: name, declaredType: res.contentType, buffer: res.body, sourceUrl: res.finalUrl },
    actorUserId,
  );
}

export async function readDocumentFile(doc: typeof document.$inferSelect) {
  const full = path.resolve(storageRoot(), doc.storagePath);
  if (!full.startsWith(storageRoot() + path.sep)) throw new Error("Ongeldig opslagpad");
  return readFile(full);
}
