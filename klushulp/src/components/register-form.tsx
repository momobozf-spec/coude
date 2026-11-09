"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerProviderAction } from "@/app/[locale]/dienstverlener-worden/actions";
import { Alert, Button, FieldError, Help, Input, Label } from "@/components/ui";

export function RegisterForm({ locale, labels: L, redirectTo }: { locale: string; labels: Record<string, string>; redirectTo: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", businessName: "", kboNumber: "", email: "", password: "", type: "professional" as "professional" | "private", terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (form.name.trim().length < 2) errs.name = L["common.required"];
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = L["common.required"];
        if (form.password.length < 10) errs.password = L["join.password_help"];
        if (!/^[01]\d{9}$/.test(form.kboNumber.replace(/[^\d]/g, ""))) errs.kboNumber = L["join.kbo_invalid"];
        if (!form.terms) errs.terms = L["common.required"];
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setBusy(true);
        setServerError(null);
        const r = await registerProviderAction({ ...form, locale, terms: true });
        setBusy(false);
        if (r.ok) {
          router.push(redirectTo);
          router.refresh();
          return;
        }
        setServerError(r.error === "email_exists" ? L["join.email_exists"] : r.error === "invalid_kbo" ? L["join.kbo_invalid"] : r.error === "rate_limited" ? L["req.rate_limited"] : r.error === "private_not_available" ? L["join.type_private_note"] : L["common.error_generic"]);
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{L["join.type_label"]}</legend>
        <div className="grid gap-2">
          <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${form.type === "professional" ? "border-brand bg-brand-soft" : "border-line-strong"}`}>
            <input type="radio" name="type" checked={form.type === "professional"} onChange={() => set("type", "professional")} className="size-5 accent-brand" />
            <span className="font-semibold">{L["join.type_professional"]}</span>
          </label>
          <label className="flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl border border-line px-4 text-muted">
            <input type="radio" name="type" disabled className="size-5" />
            <span>{L["join.type_private"]}</span>
          </label>
        </div>
        <Help>{L["join.type_private_note"]}</Help>
      </fieldset>
      <div>
        <Label htmlFor="r-name">{L["join.name"]}</Label>
        <Input id="r-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} />
        <FieldError>{errors.name}</FieldError>
      </div>
      <div>
        <Label htmlFor="r-business">{L["join.business_name"]}</Label>
        <Input id="r-business" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} autoComplete="organization" />
      </div>
      <div>
        <Label htmlFor="r-kbo">{L["join.kbo"]}</Label>
        <Input id="r-kbo" value={form.kboNumber} onChange={(e) => set("kboNumber", e.target.value)} inputMode="numeric" placeholder="0123.456.789" aria-invalid={Boolean(errors.kboNumber)} />
        <FieldError>{errors.kboNumber}</FieldError>
      </div>
      <div>
        <Label htmlFor="r-email">{L["auth.email"]}</Label>
        <Input id="r-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)} />
        <FieldError>{errors.email}</FieldError>
      </div>
      <div>
        <Label htmlFor="r-password">{L["auth.password"]}</Label>
        <Input id="r-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
        <Help>{L["join.password_help"]}</Help>
        <FieldError>{errors.password}</FieldError>
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} className="mt-1 size-5 accent-brand" />
        <span className="text-sm">{L["join.terms"]}</span>
      </label>
      <FieldError>{errors.terms}</FieldError>
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <Button type="submit" full disabled={busy}>
        {busy ? L["common.loading"] : L["join.submit"]}
      </Button>
    </form>
  );
}
