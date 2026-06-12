import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

interface CsvRow {
  name: string;
  description: string;
  price: string;
  images: string;
  category: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    if (row.name && row.price) {
      rows.push(row as unknown as CsvRow);
    }
  }

  return rows;
}

async function processImport(csvText: string) {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return { error: "Geen geldige rijen gevonden in CSV", status: 400 };
  }

  const results: { created: number; errors: string[] } = {
    created: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const price = parseFloat(row.price);
      if (isNaN(price) || price <= 0) {
        results.errors.push(`Rij ${i + 2}: Ongeldige prijs "${row.price}"`);
        continue;
      }

      // Find or create category
      let category = await prisma.category.findFirst({
        where: {
          OR: [
            { name: { equals: row.category } },
            { slug: slugify(row.category) },
          ],
        },
      });

      if (!category && row.category) {
        category = await prisma.category.create({
          data: {
            name: row.category,
            slug: slugify(row.category),
          },
        });
      }

      if (!category) {
        results.errors.push(
          `Rij ${i + 2}: Categorie is verplicht voor "${row.name}"`
        );
        continue;
      }

      // Generate unique slug
      let slug = slugify(row.name);
      const existingProduct = await prisma.product.findUnique({
        where: { slug },
      });
      if (existingProduct) {
        slug = `${slug}-${Date.now()}-${i}`;
      }

      // Parse images (pipe or semicolon separated)
      const images = row.images
        ? row.images
            .split(/[|;]/)
            .map((img: string) => img.trim())
            .filter(Boolean)
        : [];

      await prisma.product.create({
        data: {
          name: row.name,
          slug,
          description: row.description || row.name,
          price,
          images,
          categoryId: category.id,
        },
      });

      results.created++;
    } catch (rowError) {
      results.errors.push(
        `Rij ${i + 2}: Fout bij verwerken van "${row.name}" — ${rowError instanceof Error ? rowError.message : "onbekende fout"}`
      );
    }
  }

  return {
    message: `${results.created} van ${rows.length} producten geimporteerd`,
    count: results.created,
    total: rows.length,
    errors: results.errors.length > 0 ? results.errors : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geautoriseerd" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Geen toegang — alleen beheerders" },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let csvText: string;

    if (contentType.includes("multipart/form-data")) {
      // File upload from admin import page
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "Geen bestand geupload" },
          { status: 400 }
        );
      }

      csvText = await file.text();
    } else {
      // JSON body with csv field (legacy)
      const body = await request.json();

      if (!body.csv || typeof body.csv !== "string") {
        return NextResponse.json(
          { error: "CSV-tekst is verplicht" },
          { status: 400 }
        );
      }

      csvText = body.csv;
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: "CSV-bestand is leeg" },
        { status: 400 }
      );
    }

    const result = await processImport(csvText);

    if ("error" in result && result.status) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het importeren" },
      { status: 500 }
    );
  }
}
