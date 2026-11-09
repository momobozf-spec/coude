"use client";
import { useState, useTransition } from "react";
import { Alert, Button, FieldError, Input, Label, Select, Textarea } from "@/components/ui";
import {
  acceptProposalAction,
  cancelBookingAction,
  cancelRequestAction,
  expandRequestAction,
  sendCustomerMessageAction,
  submitReportAction,
  submitReviewAction,
} from "@/app/[locale]/a/[token]/actions";

type L = Record<string, string>;

export function CopyLink({ url, labels }: { url: string; labels: L }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" aria-label={labels["mine.link_title"]} />
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {}
        }}
      >
        {done ? labels["mine.copied"] : labels["mine.copy"]}
      </Button>
    </div>
  );
}

export function AcceptButton({ locale, token, proposalId, providerName, dateLabel, labels }: { locale: string; token: string; proposalId: string; providerName: string; dateLabel: string; labels: L }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming)
    return (
      <Button full onClick={() => setConfirming(true)}>
        {labels["prop.accept"]}
      </Button>
    );
  return (
    <div className="rounded-xl border border-brand/30 bg-brand-soft/60 p-4 space-y-3">
      <p className="font-semibold">{labels["prop.accept_confirm_title"]}</p>
      <p className="text-sm">{labels["prop.accept_confirm_text"].replace("{name}", providerName).replace("{date}", dateLabel)}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          {labels["common.cancel"]}
        </Button>
        <Button
          full
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await acceptProposalAction(locale, token, proposalId);
              if (!r.ok) setError(r.error === "already_booked" ? labels["mine.status_booked"] : labels["common.error_generic"]);
            })
          }
        >
          {pending ? labels["common.loading"] : labels["prop.accept_confirm_title"]}
        </Button>
      </div>
    </div>
  );
}

export function MessageThread({ locale, token, providerId, messages, labels, disabled }: { locale: string; token: string; providerId: string; messages: { id: string; senderRole: string; body: string; at: string }[]; labels: L; disabled?: boolean }) {
  const [open, setOpen] = useState(messages.length > 0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-semibold text-brand underline-offset-4 hover:underline" aria-expanded={open}>
        {labels["mine.messages"]} {messages.length ? `(${messages.length})` : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {messages.length === 0 && <p className="text-sm text-muted">{labels["mine.messages_empty"]}</p>}
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.senderRole === "customer" ? "ml-auto bg-brand-soft" : "bg-paper border border-line"}`}>
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
                  const r = await sendCustomerMessageAction(locale, token, providerId, body);
                  if (r.ok) setBody("");
                  else setError(labels["common.error_generic"]);
                });
              }}
            >
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={labels["mine.message_placeholder"]} maxLength={2000} aria-label={labels["mine.messages"]} />
              <Button type="submit" variant="secondary" disabled={pending}>
                {labels["common.send"]}
              </Button>
            </form>
          )}
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  );
}

export function ExpandRequest({ locale, token, labels }: { locale: string; token: string; labels: L }) {
  const [radius, setRadius] = useState(true);
  const [dates, setDates] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="font-semibold">{labels["mine.expand_title"]}</p>
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={radius} onChange={(e) => setRadius(e.target.checked)} className="size-5 accent-brand" />
        <span>{labels["mine.expand_radius"].replace("{km}", "+15")}</span>
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={dates} onChange={(e) => setDates(e.target.checked)} className="size-5 accent-brand" />
        <span>{labels["mine.expand_dates"]}</span>
      </label>
      {result != null && <Alert tone={result > 0 ? "ok" : "warn"}>{result > 0 ? labels["mine.expand_done"].replace("{n}", String(result)) : labels["mine.sent_no_matches"]}</Alert>}
      <Button
        variant="secondary"
        disabled={pending || (!radius && !dates)}
        onClick={() =>
          start(async () => {
            const r = await expandRequestAction(locale, token, { extraRadiusKm: radius ? 15 : 0, ignoreDates: dates });
            setResult(r.ok ? r.added : 0);
          })
        }
      >
        {pending ? labels["common.loading"] : labels["mine.expand_title"]}
      </Button>
    </div>
  );
}

export function CancelRequest({ locale, token, labels }: { locale: string; token: string; labels: L }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm)
    return (
      <Button variant="ghost" onClick={() => setConfirm(true)}>
        {labels["mine.cancel_request"]}
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{labels["mine.cancel_confirm"]}</span>
      <Button variant="danger" disabled={pending} onClick={() => start(async () => void (await cancelRequestAction(locale, token)))}>
        {labels["common.yes"]}
      </Button>
      <Button variant="secondary" onClick={() => setConfirm(false)}>
        {labels["common.no"]}
      </Button>
    </div>
  );
}

export function BookingControls({ locale, token, canCancel, labels }: { locale: string; token: string; canCancel: boolean; labels: L }) {
  const [mode, setMode] = useState<"none" | "cancel" | "report">("none");
  const [reason, setReason] = useState("");
  const [reportReason, setReportReason] = useState("no_show");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <Alert tone="ok">{done}</Alert>;
  return (
    <div className="space-y-3">
      {mode === "none" && (
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <Button variant="secondary" onClick={() => setMode("cancel")}>
              {labels["mine.booking_cancel"]}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setMode("report")}>
            {labels["mine.booking_report"]}
          </Button>
        </div>
      )}
      {mode === "cancel" && (
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">{labels["mine.booking_cancel_reason"]}</Label>
          <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMode("none")}>
              {labels["common.back"]}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelBookingAction(locale, token, reason);
                  if (r.ok) setDone(labels["mine.status_cancelled"]);
                })
              }
            >
              {labels["mine.booking_cancel"]}
            </Button>
          </div>
        </div>
      )}
      {mode === "report" && (
        <div className="space-y-2">
          <Label htmlFor="report-reason">{labels["report.reason"]}</Label>
          <Select id="report-reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            {["no_show", "quality", "price", "behaviour", "other"].map((r) => (
              <option key={r} value={r}>
                {labels[`report.reason_${r}`]}
              </option>
            ))}
          </Select>
          <Label htmlFor="report-details">{labels["report.details"]}</Label>
          <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMode("none")}>
              {labels["common.back"]}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await submitReportAction(locale, token, { reason: reportReason, details });
                  if (r.ok) setDone(labels["report.submitted"]);
                })
              }
            >
              {labels["common.send"]}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReviewForm({ locale, token, labels }: { locale: string; token: string; labels: L }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) {
          setError(labels["common.required"]);
          return;
        }
        start(async () => {
          const r = await submitReviewAction(locale, token, { rating, body });
          if (!r.ok) setError(labels["common.error_generic"]);
        });
      }}
    >
      <p className="text-sm text-muted">{labels["mine.review_help"]}</p>
      <div role="radiogroup" aria-label={labels["mine.review_rating"]} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} className={`grid size-12 place-items-center rounded-xl border text-2xl ${n <= rating ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-line-strong"}`}>
            ★
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="review-body" hint={labels["common.optional"]}>
          {labels["mine.review_body"]}
        </Label>
        <Textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={pending}>
        {labels["mine.review_submit"]}
      </Button>
    </form>
  );
}
