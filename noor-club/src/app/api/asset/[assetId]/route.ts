import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertPackAccess } from "@/lib/entitlement";
import {
  contentTypeFor,
  downloadNameFor,
  resolveAssetPath,
} from "@/lib/assets";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only way to get an asset's bytes.
 *
 * Order matters: identify, authorise, and only then touch the file. A response
 * that has already started streaming cannot be turned back into a 403.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const log = logger("asset.download");
  const { assetId } = await context.params;

  const session = await auth();
  if (!session?.user?.id) {
    log.warn("unauthenticated", { assetId });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [user, asset] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, subStatus: true, currentPeriodEnd: true },
    }),
    db.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        fileUrl: true,
        pack: { select: { slug: true, isFree: true, releaseAt: true } },
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!asset) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isSubscribed =
    (user.subStatus === "ACTIVE" || user.subStatus === "TRIALING") &&
    (!user.currentPeriodEnd || user.currentPeriodEnd.getTime() > Date.now());

  try {
    assertPackAccess({ isSubscribed }, asset.pack);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PAYWALL";
    log.warn("denied", { assetId, pack: asset.pack.slug, reason });
    return NextResponse.json({ error: reason.toLowerCase() }, { status: 403 });
  }

  const path = resolveAssetPath(asset.fileUrl);
  if (!path) {
    log.error("path outside asset root", { assetId });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    size = info.size;
  } catch {
    log.error("file missing on disk", { assetId, pack: asset.pack.slug });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Streamed rather than read into memory: these are print-quality PDFs, and a
  // serverless function should not hold a whole one per concurrent download.
  const file = createReadStream(path);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      file.on("data", (chunk) => {
        controller.enqueue(
          typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk),
        );
      });
      file.on("end", () => controller.close());
      file.on("error", (error) => controller.error(error));
    },
    cancel() {
      file.destroy();
    },
  });

  log.info("served", { assetId, pack: asset.pack.slug, bytes: size });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(asset.fileUrl),
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${downloadNameFor(asset.fileUrl)}"`,
      // Never let a CDN or shared proxy keep a paid file around.
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
