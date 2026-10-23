import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { adminProductSchema, firstIssue, requireAdmin } from "@/lib/admin";
import { missingSafetyFields, safetyErrorMessage } from "@/lib/productSafety";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = adminProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { slug: wantedSlug, ...data } = parsed.data;

  try {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { slug: true } });
    if (!category) return NextResponse.json({ error: "Categorie bestaat niet" }, { status: 400 });
    const missing = missingSafetyFields(category.slug, data);
    if (missing.length > 0) return NextResponse.json({ error: safetyErrorMessage(missing) }, { status: 400 });

    let slug = wantedSlug || slugify(data.name) || "product";
    if (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const product = await prisma.product.create({ data: { ...data, slug }, include: { category: true } });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Categorie bestaat niet" }, { status: 400 });
    }
    console.error("[admin/products] aanmaken mislukt:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Er is een fout opgetreden bij het aanmaken van het product" }, { status: 500 });
  }
}
