"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils";
import { CLP_PICTOGRAMS, CLP_PICTOGRAM_LABELS, requiresSafetyInfo } from "@/lib/productSafety";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  categoryId: string;
  featured: boolean;
  badge: string;
  status: string;
  scents?: string[];
  safetyInfo: string;
  safetyInfoFr: string;
  hazardPictograms: string[];
  manufacturerInfo: string;
  euResponsiblePerson: string;
}

const defaultProduct: ProductFormData = {
  name: "",
  slug: "",
  description: "",
  price: 0,
  comparePrice: null,
  images: [],
  sizes: [],
  colors: [],
  stock: 0,
  categoryId: "",
  featured: false,
  badge: "",
  status: "ACTIVE",
  safetyInfo: "",
  safetyInfoFr: "",
  hazardPictograms: [],
  manufacturerInfo: "",
  euResponsiblePerson: "",
};

export default function ProductForm({
  product,
  categories,
}: {
  product?: ProductFormData;
  categories: Category[];
}) {
  const router = useRouter();
  const isEdit = !!product?.id;

  const [form, setForm] = useState<ProductFormData>(product ?? defaultProduct);
  const [imagesText, setImagesText] = useState(
    product?.images?.join("\n") ?? ""
  );
  const [sizesText, setSizesText] = useState(
    product?.sizes?.join(", ") ?? ""
  );
  const [colorsText, setColorsText] = useState(
    product?.colors?.join(", ") ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const categorySlug = categories.find((c) => c.id === form.categoryId)?.slug;
  const safetyRequired = requiresSafetyInfo(categorySlug, form.scents);

  function togglePictogram(code: string) {
    setForm((prev) => ({
      ...prev,
      hazardPictograms: prev.hazardPictograms.includes(code)
        ? prev.hazardPictograms.filter((c) => c !== code)
        : [...prev.hazardPictograms, code],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // scents zit niet in het formulier; niet meesturen zodat het niet overschreven wordt.
    const { scents: _scents, ...rest } = form;
    void _scents;
    const payload = {
      ...rest,
      images: imagesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      sizes: sizesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      colors: colorsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const url = isEdit
        ? `/api/admin/products/${product!.id}`
        : "/api/admin/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Er is iets misgegaan");
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Productnaam *
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) =>
            // Bij een nieuw product volgt de slug de naam.
            setForm({ ...form, name: e.target.value, ...(isEdit ? {} : { slug: slugify(e.target.value) }) })
          }
          className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Bijv. Marokkaanse Theeglazen — Set van 6"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Slug</label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="flex h-11 w-full rounded-lg border border-border bg-muted/50 px-4 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Beschrijving *
        </label>
        <textarea
          required
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Productbeschrijving..."
        />
      </div>

      {/* Price + Compare Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Prijs *</label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={form.price || ""}
            onChange={(e) =>
              setForm({ ...form, price: parseFloat(e.target.value) || 0 })
            }
            className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Vergelijkingsprijs
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.comparePrice ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                comparePrice: e.target.value
                  ? parseFloat(e.target.value)
                  : null,
              })
            }
            className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Images */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Afbeeldingen (URL per regel)
        </label>
        <textarea
          rows={3}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
          placeholder={"https://voorbeeld.com/afbeelding1.jpg\nhttps://voorbeeld.com/afbeelding2.jpg"}
        />
      </div>

      {/* Sizes + Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Maten (komma-gescheiden)
          </label>
          <input
            type="text"
            value={sizesText}
            onChange={(e) => setSizesText(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="S, M, L, XL"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Kleuren (komma-gescheiden)
          </label>
          <input
            type="text"
            value={colorsText}
            onChange={(e) => setColorsText(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Zwart, Wit, Marineblauw"
          />
        </div>
      </div>

      {/* Stock */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Voorraad *</label>
        <input
          type="number"
          required
          min="0"
          value={form.stock || ""}
          onChange={(e) =>
            setForm({ ...form, stock: parseInt(e.target.value) || 0 })
          }
          className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Categorie *
        </label>
        <select
          required
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="">Selecteer categorie...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Productveiligheid (GPSR/CLP) */}
      <fieldset className="space-y-4 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">Veiligheid &amp; productinformatie (GPSR/CLP)</legend>
        <p className="text-xs text-muted-foreground">
          {safetyRequired
            ? "Verplicht voor kaarsen en geurproducten zodra het product actief staat: veiligheidsinformatie in het Nederlands en het Frans, en de fabrikant. Neem de gegevens over van het CLP-etiket en de documentatie van je leverancier; verzin niets."
            : "Optioneel voor deze categorie. Vul in als het product waarschuwingen of een CLP-etiket heeft."}
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Veiligheidsinformatie (NL){safetyRequired ? " *" : ""}</label>
          <textarea
            rows={4}
            value={form.safetyInfo}
            onChange={(e) => setForm({ ...form, safetyInfo: e.target.value })}
            className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Gevarenaanduidingen (H-zinnen), voorzorgsmaatregelen (P-zinnen), allergenen, gebruiksinstructies…"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Informations de sécurité (FR){safetyRequired ? " *" : ""}</label>
          <textarea
            rows={4}
            value={form.safetyInfoFr}
            onChange={(e) => setForm({ ...form, safetyInfoFr: e.target.value })}
            className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Mentions de danger (H), conseils de prudence (P), allergènes, mode d'emploi…"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">CLP-gevarenpictogrammen</p>
          <div className="flex flex-wrap gap-3">
            {CLP_PICTOGRAMS.map((code) => (
              <label key={code} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hazardPictograms.includes(code)}
                  onChange={() => togglePictogram(code)}
                  className="h-4 w-4 cursor-pointer"
                />
                {code} — {CLP_PICTOGRAM_LABELS[code].nl}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Fabrikant (naam, postadres, e-mail of website){safetyRequired ? " *" : ""}</label>
          <textarea
            rows={2}
            value={form.manufacturerInfo}
            onChange={(e) => setForm({ ...form, manufacturerInfo: e.target.value })}
            className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Verantwoordelijke marktdeelnemer in de EU (als de fabrikant buiten de EU zit)</label>
          <textarea
            rows={2}
            value={form.euResponsiblePerson}
            onChange={(e) => setForm({ ...form, euResponsiblePerson: e.target.value })}
            className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Featured */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="featured"
          checked={form.featured}
          onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          className="h-4 w-4 rounded border-border text-emerald focus:ring-emerald cursor-pointer"
        />
        <label htmlFor="featured" className="text-sm font-medium text-foreground cursor-pointer">
          Uitgelicht product
        </label>
      </div>

      {/* Badge */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Badge</label>
        <select
          value={form.badge}
          onChange={(e) => setForm({ ...form, badge: e.target.value })}
          className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="">Geen badge</option>
          <option value="NEW">NIEUW</option>
          <option value="BESTSELLER">BESTSELLER</option>
        </select>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="DRAFT">Concept</option>
          <option value="ACTIVE">Actief</option>
          <option value="ARCHIVED">Gearchiveerd</option>
        </select>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-emerald text-white px-8 h-11 text-sm font-medium hover:bg-emerald/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading
            ? "Opslaan..."
            : isEdit
              ? "Product bijwerken"
              : "Product aanmaken"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="inline-flex items-center justify-center rounded-full border border-border px-8 h-11 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
