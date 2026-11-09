import { eur } from "@/lib/format";

/** Omzet (excl. btw) tegenover kosten per dag. Server-side SVG, geen bibliotheek. */
export function RevenueChart({ series }: { series: { day: string; revenue: number; costs: number }[] }) {
  const W = 760, H = 240, padL = 56, padR = 12, padT = 12, padB = 28;
  const max = Math.max(1, ...series.map((s) => Math.max(s.revenue, s.costs)));
  const nice = niceMax(max);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const step = plotW / Math.max(1, series.length);
  const bw = Math.max(2, Math.min(14, step / 2 - 2));
  const y = (v: number) => padT + plotH - (v / nice) * plotH;
  const ticks = [0, nice / 2, nice];
  const labelEvery = Math.ceil(series.length / 8);

  return (
    <figure className="chart" style={{ margin: 0, display: "grid", gap: 10 }}>
      <div className="legend">
        <span><i style={{ background: "var(--ink)" }} />Omzet excl. btw</span>
        <span><i style={{ background: "var(--accent)" }} />Kosten</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Omzet en kosten per dag" style={{ minWidth: 520 }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{eur(t, 0)}</text>
            </g>
          ))}
          {series.map((s, i) => {
            const cx = padL + i * step + step / 2;
            return (
              <g key={s.day}>
                <rect x={cx - bw - 1} y={y(s.revenue)} width={bw} height={Math.max(0, padT + plotH - y(s.revenue))} rx="3" fill="var(--ink)">
                  <title>{`${s.day}: omzet ${eur(s.revenue)}`}</title>
                </rect>
                <rect x={cx + 1} y={y(s.costs)} width={bw} height={Math.max(0, padT + plotH - y(s.costs))} rx="3" fill="var(--accent)">
                  <title>{`${s.day}: kosten ${eur(s.costs)}`}</title>
                </rect>
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{s.day.slice(5).split("-").reverse().join("/")}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}
