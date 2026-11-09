"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, FieldError, Help, Input, Label, Select, Textarea, Badge } from "@/components/ui";
import { submitRequestAction } from "@/app/[locale]/aanvraag/actions";

export type WizardCategory = {
  slug: string;
  name: string;
  description: string;
  questions: { key: string; type: "choice" | "text"; label: string; options?: { value: string; label: string }[] }[];
};
type Muni = { postcode: string; nameNl: string; nameFr: string; active: boolean; regionNl: string; regionFr: string };
type Photo = { path: string; mimeType: string; sizeBytes: number; preview: string };

type Props = {
  locale: string;
  categories: WizardCategory[];
  initial: { description: string; place: string; categorySlug: string | null; suggestedSlug: string | null };
  target: { id: string; name: string; categorySlugs: string[] } | null;
  labels: Record<string, string>;
  limits: { maxPhotos: number; maxMb: number; minDescription: number };
  regionNames: string;
};

const STORAGE_KEY = "klushulp.wizard.v1";

function fill(s: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
}

export function RequestWizard({ locale, categories, initial, target, labels: L, limits, regionNames }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState(initial.description);
  const [categorySlug, setCategorySlug] = useState<string | null>(target ? (target.categorySlugs.includes(initial.categorySlug ?? "") ? initial.categorySlug : target.categorySlugs[0] ?? null) : initial.categorySlug);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [placeQuery, setPlaceQuery] = useState(initial.place);
  const [muni, setMuni] = useState<Muni | null>(null);
  const [suggestions, setSuggestions] = useState<Muni[]>([]);
  const [street, setStreet] = useState("");
  const [when, setWhen] = useState<"asap" | "range">("asap");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timePref, setTimePref] = useState<"any" | "morning" | "afternoon" | "evening">("any");
  const [urgent, setUrgent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const category = useMemo(() => categories.find((c) => c.slug === categorySlug) ?? null, [categories, categorySlug]);
  const availableCategories = target ? categories.filter((c) => target.categorySlugs.includes(c.slug)) : categories;
  const today = new Date().toISOString().slice(0, 10);

  // Antwoorden bewaren in de browser, zodat een herlaad niet alles wist.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      // Asynchroon herstellen: geen hydratieverschil en geen setState in de effect-body zelf.
      Promise.resolve().then(() => {
        if (!initial.description && s.description) setDescription(s.description);
        if (s.answers) setAnswers(s.answers);
        if (s.street) setStreet(s.street);
        if (s.name) setName(s.name);
        if (s.email) setEmail(s.email);
        if (s.phone) setPhone(s.phone);
        if (s.when) setWhen(s.when);
        if (s.dateFrom) setDateFrom(s.dateFrom);
        if (s.dateTo) setDateTo(s.dateTo);
        if (s.timePref) setTimePref(s.timePref);
        if (!initial.place && s.placeQuery) setPlaceQuery(s.placeQuery);
        if (s.muni) setMuni(s.muni);
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ description, answers, street, name, email, phone, when, dateFrom, dateTo, timePref, placeQuery, muni }));
    } catch {}
  }, [description, answers, street, name, email, phone, when, dateFrom, dateTo, timePref, placeQuery, muni]);

  // Gemeente opzoeken terwijl je typt.
  useEffect(() => {
    const q = placeQuery.trim();
    const chosen = muni && (q === muni.postcode || q === `${muni.postcode} ${muni.nameNl}` || q === `${muni.postcode} ${muni.nameFr}`);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      if (q.length < 2 || chosen) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/gemeenten?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const rows: Muni[] = await res.json();
        setSuggestions(rows);
        if (rows.length === 1 && /^\d{4}$/.test(q)) chooseMuni(rows[0]);
      } catch {}
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery]);

  function chooseMuni(m: Muni) {
    setMuni(m);
    setPlaceQuery(`${m.postcode} ${locale === "fr" ? m.nameFr : m.nameNl}`);
    setSuggestions([]);
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setUploadError(null);
    for (const f of Array.from(files).slice(0, limits.maxPhotos - photos.length)) {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/uploads/photo", { method: "POST", body: fd });
      if (!res.ok) {
        setUploadError(L["common.error_generic"]);
        continue;
      }
      const saved = await res.json();
      setPhotos((p) => [...p, { ...saved, preview: URL.createObjectURL(f) }]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (description.trim().length < limits.minDescription) e.description = fill(L["req.description_min"], { n: limits.minDescription });
    if (!categorySlug) e.category = L["cat.choose"];
    setErrors(e);
    return !Object.keys(e).length;
  }
  function validateStep2() {
    const e: Record<string, string> = {};
    if (!muni) e.place = /^\d{4}$/.test(placeQuery.trim()) || placeQuery.trim().length > 1 ? fill(L["req.postcode_unknown"], { region: regionNames }) : L["req.postcode_invalid"];
    else if (!muni.active) e.place = fill(L["req.postcode_unknown"], { region: regionNames });
    if (when === "range") {
      if (!dateFrom || dateFrom < today || (dateTo && dateTo < dateFrom)) e.dates = L["req.date_invalid"];
    }
    setErrors(e);
    return !Object.keys(e).length;
  }
  function validateStep3() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = L["common.required"];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = L["req.contact_email_invalid"];
    if (!consent) e.consent = L["req.consent_required"];
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    if (!validateStep3() || !muni || !categorySlug) return;
    setBusy(true);
    setServerError(null);
    const res = await submitRequestAction({
      categorySlug,
      description: description.trim(),
      answers,
      postcode: muni.postcode,
      municipality: muni.nameNl,
      streetAddress: street.trim(),
      dateFrom: when === "range" ? dateFrom : "",
      dateTo: when === "range" ? dateTo || dateFrom : "",
      timePreference: timePref,
      urgent,
      contactName: name.trim(),
      contactEmail: email.trim(),
      contactPhone: phone.trim(),
      locale,
      consent: true,
      targetProviderId: target?.id,
      photoPaths: photos.map(({ path, mimeType, sizeBytes }) => ({ path, mimeType, sizeBytes })),
    });
    setBusy(false);
    if (res.ok) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      router.push(`/${locale}/a/${res.token}?nieuw=1`);
      return;
    }
    setServerError(res.error === "rate_limited" ? L["req.rate_limited"] : res.error === "unknown_postcode" || res.error === "region_inactive" ? fill(L["req.postcode_unknown"], { region: regionNames }) : res.error === "bad_dates" ? L["req.date_invalid"] : L["common.error_generic"]);
  }

  const stepTitles = [L["req.step_1"], L["req.step_2"], L["req.step_3"]];
  const timeLabel = { any: L["req.time_any"], morning: L["req.time_morning"], afternoon: L["req.time_afternoon"], evening: L["req.time_evening"] }[timePref];

  return (
    <div>
      <header className="mb-5">
        <p className="text-sm font-semibold text-brand">{fill(L["req.step_of"], { n: step })}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{stepTitles[step - 1]}</h1>
        {target && (
          <Alert tone="brand" className="mt-3">
            <strong>{fill(L["req.to_provider"], { name: target.name })}</strong> — {fill(L["req.to_provider_help"], { name: target.name })}
          </Alert>
        )}
        <ol className="mt-4 flex gap-2" aria-label={L["req.title"]}>
          {[1, 2, 3].map((n) => (
            <li key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-brand" : "bg-line"}`} aria-current={n === step ? "step" : undefined} />
          ))}
        </ol>
      </header>

      {step === 1 && (
        <Card className="space-y-5">
          <div>
            <Label htmlFor="description">{L["req.description_label"]}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={Boolean(errors.description)} autoFocus />
            <Help>{L["req.description_help"]}</Help>
            <FieldError>{errors.description}</FieldError>
          </div>
          <div>
            <Label>{L["req.category_label"]}</Label>
            {initial.suggestedSlug && categorySlug === initial.suggestedSlug && !target && (
              <p className="mb-2 text-sm text-brand-strong">{fill(L["req.category_suggest_hint"], { cat: categories.find((c) => c.slug === initial.suggestedSlug)?.name ?? "" })}</p>
            )}
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-invalid={Boolean(errors.category)}>
              {availableCategories.map((c) => {
                const active = c.slug === categorySlug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setCategorySlug(c.slug);
                      setAnswers({});
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:border-brand"}`}
                  >
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-sm text-muted">{c.description}</span>
                  </button>
                );
              })}
            </div>
            <FieldError>{errors.category}</FieldError>
          </div>
          {category?.questions.map((q) => (
            <div key={q.key}>
              <Label htmlFor={`q-${q.key}`} hint={L["common.optional"]}>
                {q.label}
              </Label>
              {q.type === "choice" ? (
                <Select id={`q-${q.key}`} value={answers[q.key] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}>
                  <option value="">—</option>
                  {q.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input id={`q-${q.key}`} value={answers[q.key] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <div>
            <Label hint={L["common.optional"]}>{L["req.photos_label"]}</Label>
            <div className="flex flex-wrap gap-3">
              {photos.map((p, i) => (
                <div key={p.path} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="size-20 rounded-lg object-cover border border-line" />
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-white text-xs" aria-label={L["req.photos_remove"]}>
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < limits.maxPhotos && (
                <label className="grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong text-sm text-muted hover:border-brand hover:text-brand-strong">
                  <span>+ {L["req.photos_add"]}</span>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                </label>
              )}
            </div>
            <Help>{fill(L["req.photos_help"], { n: limits.maxPhotos, mb: limits.maxMb })}</Help>
            <FieldError>{uploadError}</FieldError>
          </div>
          <Button full onClick={() => validateStep1() && setStep(2)}>
            {L["common.next"]}
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <div className="relative">
            <Label htmlFor="place">{L["req.postcode_label"]} / {L["req.municipality_label"]}</Label>
            <Input
              id="place"
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value);
                setMuni(null);
              }}
              autoComplete="postal-code"
              aria-invalid={Boolean(errors.place)}
              aria-autocomplete="list"
              autoFocus
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-card" role="listbox">
                {suggestions.map((m) => (
                  <li key={`${m.postcode}-${m.nameNl}`}>
                    <button type="button" role="option" aria-selected={false} onClick={() => chooseMuni(m)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-brand-soft">
                      <span>
                        <strong>{m.postcode}</strong> {locale === "fr" ? m.nameFr : m.nameNl}
                      </span>
                      {!m.active && <Badge tone="warn">{locale === "fr" ? "pas encore actif" : "nog niet actief"}</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FieldError>{errors.place}</FieldError>
          </div>
          <div>
            <Label htmlFor="street" hint={L["common.optional"]}>
              {L["req.street_label"]}
            </Label>
            <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" />
            <Help>{L["req.street_help"]}</Help>
          </div>
          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold">{L["req.when_label"]}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["asap", "range"] as const).map((w) => (
                <label key={w} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${when === w ? "border-brand bg-brand-soft" : "border-line-strong"}`}>
                  <input type="radio" name="when" checked={when === w} onChange={() => setWhen(w)} className="size-5 accent-brand" />
                  <span className="font-semibold">{w === "asap" ? L["req.when_asap"] : L["req.when_range"]}</span>
                </label>
              ))}
            </div>
            {when === "range" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dateFrom">{L["req.date_from"]}</Label>
                  <Input id="dateFrom" type="date" min={today} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-invalid={Boolean(errors.dates)} />
                </div>
                <div>
                  <Label htmlFor="dateTo" hint={L["common.optional"]}>
                    {L["req.date_to"]}
                  </Label>
                  <Input id="dateTo" type="date" min={dateFrom || today} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            )}
            <FieldError>{errors.dates}</FieldError>
          </fieldset>
          <div>
            <Label htmlFor="timePref">{L["req.time_label"]}</Label>
            <Select id="timePref" value={timePref} onChange={(e) => setTimePref(e.target.value as typeof timePref)}>
              <option value="any">{L["req.time_any"]}</option>
              <option value="morning">{L["req.time_morning"]}</option>
              <option value="afternoon">{L["req.time_afternoon"]}</option>
              <option value="evening">{L["req.time_evening"]}</option>
            </Select>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-4">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="size-5 accent-brand" />
            <span>{L["req.urgent_label"]}</span>
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              {L["common.back"]}
            </Button>
            <Button full onClick={() => validateStep2() && setStep(3)}>
              {L["common.next"]}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold">{L["req.summary"]}</h2>
              <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
                {L["common.edit"]}
              </button>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">{L["req.category_label"]}</dt>
                <dd className="font-semibold">{category?.name}</dd>
              </div>
              <div>
                <dt className="text-muted">{L["req.description_label"]}</dt>
                <dd className="whitespace-pre-wrap">{description}</dd>
              </div>
              {category?.questions.filter((q) => answers[q.key]).map((q) => (
                <div key={q.key}>
                  <dt className="text-muted">{q.label}</dt>
                  <dd>{q.options?.find((o) => o.value === answers[q.key])?.label ?? answers[q.key]}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted">{L["req.municipality_label"]}</dt>
                <dd>
                  {muni?.postcode} {muni && (locale === "fr" ? muni.nameFr : muni.nameNl)}
                  {street && ` · ${street}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{L["req.when_label"]}</dt>
                <dd>
                  {when === "asap" ? L["req.when_asap"] : `${dateFrom}${dateTo && dateTo !== dateFrom ? ` – ${dateTo}` : ""}`} · {timeLabel}
                  {urgent && <Badge tone="danger" className="ml-2">{L["req.urgent_label"]}</Badge>}
                </dd>
              </div>
              {photos.length > 0 && (
                <div>
                  <dt className="text-muted">{L["req.photos_label"]}</dt>
                  <dd>{photos.length}</dd>
                </div>
              )}
            </dl>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">{L["req.contact_title"]}</h2>
            <div>
              <Label htmlFor="name">{L["req.contact_name"]}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} autoFocus />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="email">{L["req.contact_email"]}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.email)} />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone" hint={L["common.optional"]}>
                {L["req.contact_phone"]}
              </Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
            </div>
            <Help>{L["req.contact_help"]}</Help>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 accent-brand" aria-invalid={Boolean(errors.consent)} />
              <span className="text-sm">{L["req.consent"]}</span>
            </label>
            <FieldError>{errors.consent}</FieldError>
            {serverError && <Alert tone="danger">{serverError}</Alert>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={busy}>
                {L["common.back"]}
              </Button>
              <Button full onClick={submit} disabled={busy}>
                {busy ? L["req.submitting"] : L["req.submit"]}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
