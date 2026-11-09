import { NextResponse } from "next/server";
import { saveUpload, UploadError } from "@/lib/uploads";
import { allowSubmission } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

/** Foto-upload voor een aanvraag (anoniem, met limiet per IP). Het pad wordt pas aan een aanvraag gekoppeld bij verzenden. */
export async function POST(req: Request) {
  if (!(await allowSubmission(await clientIp(), "message"))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  try {
    const saved = await saveUpload(file, "photo");
    return NextResponse.json(saved);
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
