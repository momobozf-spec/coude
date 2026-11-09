"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAvailabilityAction } from "@/app/[locale]/dashboard/actions";
import { Alert, Button, Input, Label } from "@/components/ui";

type Slot = { weekday: number; startMin: number; endMin: number };
type Off = { dateFrom: string; dateTo: string; note: string };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function AvailabilityForm({ locale, labels: L, initial }: { locale: string; labels: Record<string, string>; initial: { slots: Slot[]; timeOff: Off[] } }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(initial.slots);
  const [offs, setOffs] = useState<Off[]>(initial.timeOff);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const days = [1, 2, 3, 4, 5, 6, 0];

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateAvailabilityAction(locale, { slots: slots.filter((s) => s.endMin > s.startMin), timeOff: offs.filter((o) => o.dateFrom && o.dateTo && o.dateTo >= o.dateFrom) });
          setMsg(r.ok ? { tone: "ok", text: L["common.saved"] } : { tone: "danger", text: L["common.error_generic"] });
          if (r.ok) router.refresh();
        });
      }}
    >
      {slots.length === 0 && <Alert tone="warn">{L["avail.none"]}</Alert>}
      <div className="space-y-3">
        {days.map((d) => {
          const mine = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.weekday === d);
          return (
            <div key={d} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{L[`avail.weekday_${d}`]}</p>
                <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setSlots((s) => [...s, { weekday: d, startMin: 8 * 60, endMin: 17 * 60 }])}>
                  + {L["avail.add_slot"]}
                </Button>
              </div>
              {mine.map(({ s, i }) => (
                <div key={i} className="mt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor={`from-${i}`}>{L["avail.from"]}</Label>
                    <Input id={`from-${i}`} type="time" value={toHHMM(s.startMin)} onChange={(e) => setSlots((all) => all.map((x, j) => (j === i ? { ...x, startMin: toMin(e.target.value) } : x)))} className="w-32" />
                  </div>
                  <div>
                    <Label htmlFor={`to-${i}`}>{L["avail.to"]}</Label>
                    <Input id={`to-${i}`} type="time" value={toHHMM(s.endMin)} onChange={(e) => setSlots((all) => all.map((x, j) => (j === i ? { ...x, endMin: toMin(e.target.value) } : x)))} className="w-32" />
                  </div>
                  <Button type="button" variant="danger" className="min-h-10 px-3 text-sm" onClick={() => setSlots((all) => all.filter((_, j) => j !== i))}>
                    {L["avail.remove"]}
                  </Button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{L["avail.time_off"]}</p>
            <p className="text-sm text-muted">{L["avail.time_off_help"]}</p>
          </div>
          <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setOffs((o) => [...o, { dateFrom: "", dateTo: "", note: "" }])}>
            + {L["avail.add_time_off"]}
          </Button>
        </div>
        {offs.map((o, i) => (
          <div key={i} className="mt-2 flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor={`off-from-${i}`}>{L["avail.from"]}</Label>
              <Input id={`off-from-${i}`} type="date" value={o.dateFrom} onChange={(e) => setOffs((all) => all.map((x, j) => (j === i ? { ...x, dateFrom: e.target.value } : x)))} />
            </div>
            <div>
              <Label htmlFor={`off-to-${i}`}>{L["avail.to"]}</Label>
              <Input id={`off-to-${i}`} type="date" value={o.dateTo} min={o.dateFrom} onChange={(e) => setOffs((all) => all.map((x, j) => (j === i ? { ...x, dateTo: e.target.value } : x)))} />
            </div>
            <Button type="button" variant="danger" className="min-h-10 px-3 text-sm" onClick={() => setOffs((all) => all.filter((_, j) => j !== i))}>
              {L["avail.remove"]}
            </Button>
          </div>
        ))}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? L["common.loading"] : L["common.save"]}
      </Button>
    </form>
  );
}
