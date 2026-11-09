import "server-only";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "./env";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": "pdf" };

function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

export class UploadError extends Error {}

/**
 * Bewaart een upload veilig: type op inhoud (niet op bestandsnaam), groottelimiet, willekeurige naam, buiten public/.
 * Geeft het relatieve pad terug dat in de database wordt opgeslagen.
 */
export async function saveUpload(file: File, kind: "photo" | "document"): Promise<{ path: string; mimeType: string; sizeBytes: number }> {
  if (file.size > env.uploadMaxBytes) throw new UploadError("too_large");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  const allowed = kind === "photo" ? IMAGE_TYPES : DOC_TYPES;
  if (!mime || !allowed[mime]) throw new UploadError("bad_type");
  const dir = path.join(env.storageDir, kind === "photo" ? "photos" : "documents");
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${allowed[mime]}`;
  await writeFile(path.join(dir, name), buf);
  return { path: `${kind === "photo" ? "photos" : "documents"}/${name}`, mimeType: mime, sizeBytes: buf.length };
}

export async function readUpload(relPath: string): Promise<{ buf: Buffer; mimeType: string } | null> {
  if (!/^(photos|documents)\/[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(relPath)) return null;
  const full = path.join(env.storageDir, relPath);
  try {
    await stat(full);
  } catch {
    return null;
  }
  const buf = await readFile(full);
  const ext = relPath.split(".").pop();
  const mimeType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "application/pdf";
  return { buf, mimeType };
}
