import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminProductSchema, firstIssue, parseAdminProductPatch, requireAdmin } from "@/lib/admin";
import { missingSafetyFields, safetyErrorMessage } from "@/lib/productSafety";

type Params = { params: Promise<{ id: string }> };

/** Volledige update vanuit het productformulier. */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const raw = await request.json().catch(() => null);
  const parsed = adminProductSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  // Velden die het formulier niet meestuurt (bv. descriptionFr, materials)
  // niet met schema-standaardwaarden overschrijven.
  const sent = new Set(raw && typeof raw === "object" ? Object.keys(raw) : []);
  const { slug, ...all } = parsed.data;
  const data = Object.fromEntries(
    Object.entries(all).filter(([key]) => sent.has(key)),
  ) as typeof all;

  try {
    const [category, existing] = await Promise.all([
      prisma.category.findUnique({ where: { id: all.categoryId }, select: { slug: true } }),
      prisma.product.findUnique({
        where: { id },
        select: { status: true, scents: true, safetyInfo: true, safetyInfoFr: true, manufacturerInfo: true },
      }),
    ]);
    if (!existing) return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
    if (!category) return NextResponse.json({ error: "Categorie bestaat niet" }, { status: 400 });
    const missing = missingSafetyFields(category.slug, { ...existing, ...data });
    if (missing.length > 0) return NextResponse.json({ error: safetyErrorMessage(missing) }, { status: 400 });

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
    // De veiligheidsregel geldt voor het product zoals het ná deze wijziging is.
    const existing = await prisma.product.findUnique({
      where: { id },
      select: {
        status: true, scents: true, safetyInfo: true, safetyInfoFr: true, manufacturerInfo: true, categoryId: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
    const merged = { ...existing, ...data };
    const category = await prisma.category.findUnique({ where: { id: merged.categoryId }, select: { slug: true } });
    if (!category) return NextResponse.json({ error: "Categorie bestaat niet" }, { status: 400 });
    const missing = missingSafetyFields(category.slug, merged);
    if (missing.length > 0) return NextResponse.json({ error: safetyErrorMessage(missing) }, { status: 400 });

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
