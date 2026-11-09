"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";

type Props = {
  locale: string;
  categories: { slug: string; name: string }[];
  labels: { placeholder: string; postcode: string; postcodePlaceholder: string; cta: string; describe: string };
};

/** Homepage-invoer: beschrijving + plaats, optioneel een categorieknop. Stuurt door naar de wizard met voorgevulde waarden. */
export function HomeSearch({ locale, categories, labels }: Props) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  function go(e?: React.FormEvent) {
    e?.preventDefault();
    const q = new URLSearchParams();
    if (description.trim()) q.set("d", description.trim());
    if (place.trim()) q.set("p", place.trim());
    if (category) q.set("c", category);
    router.push(`/${locale}/aanvraag${q.size ? `?${q}` : ""}`);
  }

  return (
    <form onSubmit={go} className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <Label htmlFor="home-description" className="sr-only">
        {labels.describe}
      </Label>
      <Textarea id="home-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={labels.placeholder} className="min-h-24" />
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Categorie">
        {categories.map((c) => {
          const active = category === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.slug)}
              className={`rounded-full border px-4 min-h-10 text-sm font-semibold transition-colors ${active ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft"}`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="home-place" className="sr-only">
            {labels.postcode}
          </Label>
          <Input id="home-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={labels.postcodePlaceholder} inputMode="text" autoComplete="postal-code" />
        </div>
        <Button type="submit" className="sm:min-w-40">
          {labels.cta}
        </Button>
      </div>
    </form>
  );
}
