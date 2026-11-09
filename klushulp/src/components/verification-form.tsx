"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitVerificationAction } from "@/app/[locale]/dashboard/actions";
import { Alert, Button, Input, Label } from "@/components/ui";

export function VerificationForm({ locale, kind, labels: L }: { locale: string; kind: string; labels: Record<string, string> }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("kind", kind);
        start(async () => {
          const r = await submitVerificationAction(locale, fd);
          setMsg(r.ok ? { tone: "ok", text: L["common.saved"] } : { tone: "danger", text: L["common.error_generic"] });
          if (r.ok) router.refresh();
        });
      }}
    >
      <div>
        <Label htmlFor={`ref-${kind}`}>{L["ver.reference"]}</Label>
        <Input id={`ref-${kind}`} name="reference" maxLength={200} />
      </div>
      <div>
        <Label htmlFor={`doc-${kind}`}>{L["ver.document"]}</Label>
        <input id={`doc-${kind}`} name="file" type="file" accept="application/pdf,image/jpeg,image/png" className="block w-full text-sm" />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? L["common.loading"] : L["ver.submit"]}
      </Button>
      {msg && (
        <div className="sm:col-span-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </form>
  );
}
