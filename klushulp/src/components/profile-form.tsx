"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction, uploadProfilePhotoAction } from "@/app/[locale]/dashboard/actions";
import { Alert, Button, FieldError, Help, Input, Label, Textarea } from "@/components/ui";

type Initial = { displayName: string; bio: string; phone: string; yearsExperience: string; hourlyRate: string; travelFee: string; basePostcode: string; radiusKm: number; photoPath: string | null; categories: { categoryId: string; services: string }[] };
const euroToCents = (s: string) => {
  const c = s.replace(/\s|€/g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(c) ? Math.round(Number.parseFloat(c) * 100) : null;
};

export function ProfileForm({ locale, labels: L, categories, initial }: { locale: string; labels: Record<string, string>; categories: { id: string; name: string; allowed: boolean }[]; initial: Initial }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setF((x) => ({ ...x, [k]: v }));
  const catOf = (id: string) => f.categories.find((c) => c.categoryId === id);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (f.displayName.trim().length < 2) errs.displayName = L["common.required"];
        if (!/^[1-9]\d{3}$/.test(f.basePostcode)) errs.basePostcode = L["common.required"];
        if (f.hourlyRate && euroToCents(f.hourlyRate) == null) errs.hourlyRate = L["common.required"];
        if (f.travelFee && euroToCents(f.travelFee) == null) errs.travelFee = L["common.required"];
        setErrors(errs);
        if (Object.keys(errs).length) return;
        start(async () => {
          const r = await updateProfileAction(locale, {
            displayName: f.displayName.trim(),
            bio: f.bio,
            phone: f.phone,
            yearsExperience: f.yearsExperience ? Number.parseInt(f.yearsExperience, 10) : null,
            hourlyRateCents: f.hourlyRate ? euroToCents(f.hourlyRate) : null,
            travelFeeCents: euroToCents(f.travelFee || "0") ?? 0,
            basePostcode: f.basePostcode,
            radiusKm: f.radiusKm,
            categories: f.categories,
            photoPath: f.photoPath,
          });
          if (r.ok) {
            setMsg({ tone: "ok", text: L["common.saved"] });
            router.refresh();
          } else setMsg({ tone: "danger", text: r.error === "unknown_postcode" ? L["req.postcode_unknown"].replace("{region}", "") : r.error === "category_not_allowed" ? L["prof.category_not_allowed"] : L["common.error_generic"] });
        });
      }}
    >
      <div className="flex items-center gap-4">
        {f.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/files/${f.photoPath}`} alt="" className="size-20 rounded-xl border border-line object-cover" />
        ) : (
          <span aria-hidden className="grid size-20 place-items-center rounded-xl bg-brand-soft text-2xl font-bold text-brand-strong">{f.displayName.slice(0, 1)}</span>
        )}
        <div>
          <Label htmlFor="photo">{L["prof.photo"]}</Label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              const r = await uploadProfilePhotoAction(fd);
              if (r.ok) set("photoPath", r.path);
              else setMsg({ tone: "danger", text: L["common.error_generic"] });
            }}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="displayName">{L["prof.display_name"]}</Label>
        <Input id="displayName" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} aria-invalid={Boolean(errors.displayName)} />
        <FieldError>{errors.displayName}</FieldError>
      </div>
      <div>
        <Label htmlFor="bio">{L["prof.bio"]}</Label>
        <Textarea id="bio" value={f.bio} onChange={(e) => set("bio", e.target.value)} maxLength={1500} />
        <Help>{L["prof.bio_help"]}</Help>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">{L["prof.phone"]}</Label>
          <Input id="phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="years" hint={L["common.optional"]}>
            {L["prof.years"]}
          </Label>
          <Input id="years" inputMode="numeric" value={f.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <Label htmlFor="hourly" hint={L["common.optional"]}>
            {L["prof.hourly_rate"]}
          </Label>
          <Input id="hourly" inputMode="decimal" value={f.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} aria-invalid={Boolean(errors.hourlyRate)} />
          <FieldError>{errors.hourlyRate}</FieldError>
        </div>
        <div>
          <Label htmlFor="travel">{L["prof.travel_fee"]}</Label>
          <Input id="travel" inputMode="decimal" value={f.travelFee} onChange={(e) => set("travelFee", e.target.value)} aria-invalid={Boolean(errors.travelFee)} />
          <FieldError>{errors.travelFee}</FieldError>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{L["prof.categories"]}</legend>
        <div className="space-y-2">
          {categories.map((c) => {
            const on = Boolean(catOf(c.id));
            return (
              <div key={c.id} className={`rounded-xl border p-3 ${on ? "border-brand bg-brand-soft/50" : "border-line-strong"} ${!c.allowed ? "opacity-60" : ""}`}>
                <label className="flex min-h-10 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!c.allowed}
                    onChange={(e) => set("categories", e.target.checked ? [...f.categories, { categoryId: c.id, services: "" }] : f.categories.filter((x) => x.categoryId !== c.id))}
                    className="size-5 accent-brand"
                  />
                  <span className="font-semibold">{c.name}</span>
                  {!c.allowed && <span className="text-xs text-muted">{L["cat.pro_only"]}</span>}
                </label>
                {on && (
                  <div className="mt-2">
                    <Label htmlFor={`services-${c.id}`}>{L["prof.services"]}</Label>
                    <Input id={`services-${c.id}`} value={catOf(c.id)?.services ?? ""} onChange={(e) => set("categories", f.categories.map((x) => (x.categoryId === c.id ? { ...x, services: e.target.value } : x)))} maxLength={500} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="basePostcode">{L["prof.base_postcode"]}</Label>
          <Input id="basePostcode" inputMode="numeric" value={f.basePostcode} onChange={(e) => set("basePostcode", e.target.value.replace(/\D/g, "").slice(0, 4))} aria-invalid={Boolean(errors.basePostcode)} />
          <FieldError>{errors.basePostcode}</FieldError>
        </div>
        <div>
          <Label htmlFor="radius">{L["prof.radius"]}</Label>
          <div className="flex items-center gap-3">
            <input id="radius" type="range" min={1} max={60} value={f.radiusKm} onChange={(e) => set("radiusKm", Number(e.target.value))} className="flex-1 accent-brand" />
            <span className="w-16 text-right font-semibold">{f.radiusKm} km</span>
          </div>
        </div>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? L["common.loading"] : L["common.save"]}
      </Button>
    </form>
  );
}
