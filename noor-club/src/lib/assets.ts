import { join, normalize, resolve, sep, extname } from "node:path";

/**
 * Asset files live outside `public/` on purpose.
 *
 * Anything under `public/` is served statically by the CDN, with no session and
 * no entitlement check — one shared link and a paid pack is free for everyone.
 * These files are read by the API route instead, which checks access first.
 */
export const PRIVATE_ASSET_ROOT = resolve(process.cwd(), "private", "assets");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".zip": "application/zip",
};

export function contentTypeFor(fileUrl: string): string {
  return CONTENT_TYPES[extname(fileUrl).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Resolves a stored `Asset.fileUrl` to an absolute path, refusing anything that
 * escapes the asset root.
 *
 * The value comes out of the database, but content is authored by hand and a
 * stray `../../.env` would otherwise be served to a paying customer. Returns
 * null rather than throwing so the route can answer 404.
 */
export function resolveAssetPath(fileUrl: string): string | null {
  if (fileUrl.includes("\0")) return null;

  const relative = normalize(fileUrl).replace(/^([/\\])+/, "");
  if (relative.split(/[/\\]/).includes("..")) return null;

  const full = resolve(join(PRIVATE_ASSET_ROOT, relative));
  if (full !== PRIVATE_ASSET_ROOT && !full.startsWith(PRIVATE_ASSET_ROOT + sep)) {
    return null;
  }

  return full;
}

/** Filename the browser should save the download as. */
export function downloadNameFor(fileUrl: string): string {
  const parts = fileUrl.split(/[/\\]/);
  return parts[parts.length - 1] ?? "download";
}
