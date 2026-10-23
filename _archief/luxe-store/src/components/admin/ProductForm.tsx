"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { slugify } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface ProductData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  images: string[];
  stock: number;
  featured: boolean;
  archived: boolean;
  categoryId: string;
}

interface ProductFormProps {
  categories: Category[];
  product?: ProductData;
}

export default function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: product?.price?.toString() || "",
    comparePrice: product?.comparePrice?.toString() || "",
    images: product?.images?.join("\n") || "",
    stock: product?.stock?.toString() || "0",
    categoryId: product?.categoryId || categories[0]?.id || "",
    featured: product?.featured || false,
    archived: product?.archived || false,
  });

  const handleNameChange = (value: string) => {
    setForm({
      ...form,
      name: value,
      slug: product ? form.slug : slugify(value),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      price: parseFloat(form.price),
      comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
      images: form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      stock: parseInt(form.stock),
      categoryId: form.categoryId,
      featured: form.featured,
      archived: form.archived,
    };

    try {
      const url = product
        ? `/api/admin/products/${product.id}`
        : "/api/admin/products";
      const method = product ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Basic Information</h2>

        <Input
          label="Product Name"
          id="name"
          required
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
        />

        <Input
          label="Slug"
          id="slug"
          required
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />

        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="categoryId" className="text-sm font-medium">
            Category
          </label>
          <select
            id="categoryId"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Pricing & Inventory</h2>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price ($)"
            id="price"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <Input
            label="Compare Price ($)"
            id="comparePrice"
            type="number"
            step="0.01"
            min="0"
            value={form.comparePrice}
            onChange={(e) =>
              setForm({ ...form, comparePrice: e.target.value })
            }
          />
        </div>

        <Input
          label="Stock"
          id="stock"
          type="number"
          min="0"
          required
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
      </div>

      <div className="rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Images</h2>
        <div className="space-y-1.5">
          <label htmlFor="images" className="text-sm font-medium">
            Image URLs (one per line)
          </label>
          <textarea
            id="images"
            rows={4}
            value={form.images}
            onChange={(e) => setForm({ ...form, images: e.target.value })}
            placeholder="https://images.unsplash.com/..."
            className="flex w-full rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Settings</h2>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) =>
                setForm({ ...form, featured: e.target.checked })
              }
              className="h-4 w-4 rounded cursor-pointer"
            />
            <span className="text-sm">Featured product</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.archived}
              onChange={(e) =>
                setForm({ ...form, archived: e.target.checked })
              }
              className="h-4 w-4 rounded cursor-pointer"
            />
            <span className="text-sm">Archived</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={loading}>
          {product ? "Update Product" : "Create Product"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
