import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminProductSchema, firstIssue, parseAdminProductPatch, requireAdmin } from "@/lib/admin";

type Params = { params: Promise<{ id: string }> };

/** Volledige update vanuit het productformulier. */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = adminProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { slug, ...data } = parsed.data;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { ...data, ...(slug ? { slug } : {}) },
      include: { category: true },
    });
    return NextResponse.json(product);
  } catch (error) {
    return productError(error, "bijwerken");
  }
}

/**
 * Gedeeltelijke update. Alleen de velden uit het productschema zijn toegestaan;
 * een onbekend veld (bv. id of createdAt) wordt geweigerd in plaats van
 * blind doorgegeven aan de database.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = parseAdminProductPatch(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const product = await prisma.product.update({ where: { id }, data, include: { category: true } });
    return NextResponse.json(product);
  } catch (error) {
    return productError(error, "bijwerken");
  }
}

/**
 * Verwijderen. Een product dat al besteld werd, blijft bestaan voor de
 * orderhistoriek en wordt gearchiveerd (niet meer zichtbaar of koopbaar).
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const ordered = await prisma.orderItem.count({ where: { productId: id } });
    if (ordered > 0) {
      await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
      return NextResponse.json({ success: true, archived: true });
    }
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true, archived: false });
  } catch (error) {
    return productError(error, "verwijderen");
  }
}

function productError(error: unknown, action: string): NextResponse {
  const code = (error as { code?: string }).code;
  if (code === "P2025") return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
  if (code === "P2002") return NextResponse.json({ error: "Deze slug is al in gebruik" }, { status: 409 });
  if (code === "P2003") return NextResponse.json({ error: "Categorie bestaat niet" }, { status: 400 });
  console.error(`[admin/products] ${action} mislukt:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: `Er is een fout opgetreden bij het ${action} van het product` }, { status: 500 });
}
