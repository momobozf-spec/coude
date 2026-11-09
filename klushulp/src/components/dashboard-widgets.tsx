"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, FieldError, Help, Input, Label, Select, Textarea } from "@/components/ui";
import { bookingTransitionAction, providerMessageAction, sendProposalAction, submitForReviewAction, withdrawProposalAction } from "@/app/[locale]/dashboard/actions";

type L = Record<string, string>;
const fill = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, String(v)), s);

export function SubmitForReview({ locale, disabled, labels }: { locale: string; disabled: boolean; labels: L }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <Alert tone="ok">{labels.done}</Alert>;
  return (
    <Button
      variant="secondary"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await submitForReviewAction(locale);
          if (r.ok) setDone(true);
        })
      }
    >
      {pending ? labels.loading : labels.submit}
    </Button>
  );
}

function euroToCents(s: string): number | null {
  const c = s.replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(c)) return null;
  return Math.round(Number.parseFloat(c) * 100);
}

export function ProposalForm({ locale, requestId, labels: L, fee, defaults, suggestedStart }: { locale: string; requestId: string; labels: L; fee: { bps: number; minCents: number; bpsLabel: string; minLabel: string }; defaults: { hourly: string; travel: string }; suggestedStart: string }) {
  const router = useRouter();
  const [priceType, setPriceType] = useState<"fixed" | "hourly" | "estimate" | "inspection">("fixed");
  const [amount, setAmount] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [hourly, setHourly] = useState(defaults.hourly);
  const [hMin, setHMin] = useState("1");
  const [hMax, setHMax] = useState("2");
  const [travel, setTravel] = useState(defaults.travel);
  const [materialsIncluded, setMaterialsIncluded] = useState(false);
  const [materialsNote, setMaterialsNote] = useState("");
  const [included, setIncluded] = useState("");
  const [excluded, setExcluded] = useState("");
  const [start, setStart] = useState(suggestedStart);
  const [duration, setDuration] = useState("2");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const feePreview = useMemo(() => {
    let ref = 0;
    if (priceType === "fixed" || priceType === "inspection") ref = euroToCents(amount) ?? 0;
    if (priceType === "estimate") ref = euroToCents(amountMin) ?? 0;
    if (priceType === "hourly") ref = (euroToCents(hourly) ?? 0) * (Number.parseInt(hMin, 10) || 1);
    const pct = Math.round((ref * fee.bps) / 10_000);
    return Math.max(pct, fee.minCents);
  }, [priceType, amount, amountMin, hourly, hMin, fee]);
  const eur = (c: number) => new Intl.NumberFormat(locale === "fr" ? "fr-BE" : "nl-BE", { style: "currency", currency: "EUR" }).format(c / 100);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const payload = {
      priceType,
      amountCents: priceType === "fixed" || priceType === "inspection" ? euroToCents(amount || (priceType === "inspection" ? "0" : "")) : null,
      amountMinCents: priceType === "estimate" ? euroToCents(amountMin) : null,
      amountMaxCents: priceType === "estimate" ? euroToCents(amountMax) : null,
      hourlyRateCents: priceType === "hourly" ? euroToCents(hourly) : null,
      estimatedHoursMin: priceType === "hourly" ? Number.parseInt(hMin, 10) || null : null,
      estimatedHoursMax: priceType === "hourly" ? Number.parseInt(hMax, 10) || null : null,
      travelFeeCents: euroToCents(travel || "0") ?? 0,
      materialsIncluded,
      materialsNote,
      included,
      excluded,
      proposedStart: start ? new Date(start).toISOString() : "",
      durationHours: Number.parseFloat(duration) || 0,
      message,
    };
    if (priceType === "fixed" && !(payload.amountCents && payload.amountCents > 0)) errs.amount = L["pf.invalid_amount"];
    if (priceType === "inspection" && payload.amountCents == null) errs.amount = L["pf.invalid_amount"];
    if (priceType === "estimate") {
      if (!payload.amountMinCents || payload.amountMaxCents == null) errs.amountMin = L["pf.invalid_amount"];
      else if (payload.amountMaxCents < payload.amountMinCents) errs.amountMax = L["pf.invalid_range"];
    }
    if (priceType === "hourly") {
      if (!payload.hourlyRateCents) errs.hourly = L["pf.invalid_amount"];
      if (!payload.estimatedHoursMin || !payload.estimatedHoursMax) errs.hours = L["pf.invalid_amount"];
      else if (payload.estimatedHoursMax < payload.estimatedHoursMin) errs.hours = L["pf.invalid_range"];
    }
    if (!start || new Date(start).getTime() <= Date.now()) errs.start = L["pf.invalid_start"];
    if (!(payload.durationHours >= 0.5)) errs.duration = L["pf.invalid_amount"];
    setErrors(errs);
    if (Object.keys(errs).length) return;
    run(async () => {
      const r = await sendProposalAction(locale, requestId, payload);
      if (r.ok) {
        router.refresh();
        return;
      }
      setServerError(r.error === "already_sent" ? L["pf.already_sent"] : r.error === "request_closed" ? L["dash.request_closed"] : r.error === "invalid_start" ? L["pf.invalid_start"] : r.error === "invalid_range" ? L["pf.invalid_range"] : L["common.error_generic"]);
    });
  }

  const amountField = (id: string, label: string, value: string, set: (v: string) => void, err?: string) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">€</span>
        <Input id={id} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} className="pl-8" aria-invalid={Boolean(err)} />
      </div>
      <FieldError>{err}</FieldError>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="priceType">{L["pf.price_type"]}</Label>
        <Select id="priceType" value={priceType} onChange={(e) => setPriceType(e.target.value as typeof priceType)}>
          <option value="fixed">{L["prop.price_fixed"]}</option>
          <option value="hourly">{L["prop.price_hourly"]}</option>
          <option value="estimate">{L["prop.price_estimate"]}</option>
          <option value="inspection">{L["prop.price_inspection"]}</option>
        </Select>
        {priceType === "estimate" && <Help>{L["prop.estimate_note"]}</Help>}
        {priceType === "inspection" && <Help>{L["prop.inspection_note"]}</Help>}
      </div>
      {priceType === "fixed" && amountField("amount", L["pf.amount"], amount, setAmount, errors.amount)}
      {priceType === "inspection" && amountField("amount", L["pf.inspection_amount"], amount, setAmount, errors.amount)}
      {priceType === "estimate" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {amountField("amountMin", L["pf.amount_min"], amountMin, setAmountMin, errors.amountMin)}
          {amountField("amountMax", L["pf.amount_max"], amountMax, setAmountMax, errors.amountMax)}
        </div>
      )}
      {priceType === "hourly" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {amountField("hourly", L["pf.hourly_rate"], hourly, setHourly, errors.hourly)}
          <div>
            <Label htmlFor="hMin">{L["pf.hours_min"]}</Label>
            <Input id="hMin" inputMode="numeric" value={hMin} onChange={(e) => setHMin(e.target.value)} aria-invalid={Boolean(errors.hours)} />
          </div>
          <div>
            <Label htmlFor="hMax">{L["pf.hours_max"]}</Label>
            <Input id="hMax" inputMode="numeric" value={hMax} onChange={(e) => setHMax(e.target.value)} aria-invalid={Boolean(errors.hours)} />
            <FieldError>{errors.hours}</FieldError>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {amountField("travel", L["pf.travel_fee"], travel, setTravel)}
        <div>
          <Label htmlFor="duration">{L["pf.duration"]}</Label>
          <Input id="duration" inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} aria-invalid={Boolean(errors.duration)} />
          <FieldError>{errors.duration}</FieldError>
        </div>
      </div>
      <div>
        <Label htmlFor="start">{L["pf.start"]}</Label>
        <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={Boolean(errors.start)} />
        <FieldError>{errors.start}</FieldError>
      </div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-4">
        <input type="checkbox" checked={materialsIncluded} onChange={(e) => setMaterialsIncluded(e.target.checked)} className="size-5 accent-brand" />
        <span>{L["pf.materials_included"]}</span>
      </label>
      <div>
        <Label htmlFor="materialsNote" hint={L["common.optional"]}>
          {L["pf.materials_note"]}
        </Label>
        <Input id="materialsNote" value={materialsNote} onChange={(e) => setMaterialsNote(e.target.value)} maxLength={500} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="included">{L["pf.included"]}</Label>
          <Textarea id="included" value={included} onChange={(e) => setIncluded(e.target.value)} maxLength={1000} className="min-h-24" />
        </div>
        <div>
          <Label htmlFor="excluded">{L["pf.excluded"]}</Label>
          <Textarea id="excluded" value={excluded} onChange={(e) => setExcluded(e.target.value)} maxLength={1000} className="min-h-24" />
        </div>
      </div>
      <div>
        <Label htmlFor="message" hint={L["common.optional"]}>
          {L["pf.message"]}
        </Label>
        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} className="min-h-24" />
      </div>
      <Alert tone="brand">
        <p className="font-semibold">{fill(L["pf.fee_preview"], { fee: eur(feePreview) })}</p>
        <p className="text-sm">{fill(L["pf.fee_explain"], { bps: fee.bpsLabel, min: fee.minLabel })}</p>
      </Alert>
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <Button type="submit" full disabled={pending}>
        {pending ? L["common.loading"] : L["dash.send_proposal"]}
      </Button>
    </form>
  );
}

export function WithdrawProposal({ locale, proposalId, labels }: { locale: string; proposalId: string; labels: L }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await withdrawProposalAction(locale, proposalId);
          router.refresh();
        })
      }
    >
      {labels["dash.proposal_withdraw"]}
    </Button>
  );
}

export function ProviderThread({ locale, requestId, messages, labels, disabled }: { locale: string; requestId: string; messages: { id: string; senderRole: string; body: string; at: string }[]; labels: L; disabled?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {messages.length === 0 && <p className="text-sm text-muted">{labels["mine.messages_empty"]}</p>}
      <ul className="space-y-2">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.senderRole === "provider" ? "ml-auto bg-brand-soft" : "bg-paper border border-line"}`}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-xs text-muted">{m.at}</p>
          </li>
        ))}
      </ul>
      {!disabled && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            start(async () => {
              const r = await providerMessageAction(locale, requestId, body);
              if (r.ok) {
                setBody("");
                router.refresh();
              } else setError(labels["common.error_generic"]);
            });
          }}
        >
          <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} aria-label={labels["mine.messages"]} />
          <Button type="submit" variant="secondary" disabled={pending}>
            {labels["common.send"]}
          </Button>
        </form>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function BookingActions({ locale, bookingId, status, labels }: { locale: string; bookingId: string; status: string; labels: L }) {
  const router = useRouter();
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (to: "in_progress" | "completed" | "cancelled") =>
    start(async () => {
      const r = await bookingTransitionAction(locale, bookingId, to, reason);
      if (r.ok) router.refresh();
      else setError(labels["common.error_generic"]);
    });
  if (!["confirmed", "in_progress"].includes(status)) return null;
  return (
    <div className="space-y-3">
      {!cancelMode ? (
        <div className="flex flex-wrap gap-2">
          {status === "confirmed" && (
            <Button variant="secondary" disabled={pending} onClick={() => go("in_progress")}>
              {labels["dash.job_start"]}
            </Button>
          )}
          <Button disabled={pending} onClick={() => go("completed")}>
            {labels["dash.job_complete"]}
          </Button>
          <Button variant="ghost" onClick={() => setCancelMode(true)}>
            {labels["dash.job_cancel"]}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">{labels["mine.booking_cancel_reason"]}</Label>
          <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCancelMode(false)}>
              {labels["common.back"]}
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => go("cancelled")}>
              {labels["dash.job_cancel"]}
            </Button>
          </div>
        </div>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}
