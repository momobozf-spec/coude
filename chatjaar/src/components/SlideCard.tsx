import { forwardRef } from "react";
import { BRAND, BRAND_LOWER } from "@/lib/brand";
import type { SlideSpec } from "@/lib/slides";

interface Props {
  spec: SlideSpec;
  index: number;
  total: number;
  year: number;
  locked?: boolean;
}

export const SlideCard = forwardRef<HTMLDivElement, Props>(function SlideCard({ spec, index, total, year, locked }, ref) {
  const long = (spec.headline?.length ?? 0) > 22;
  return (
    <div
      ref={ref}
      className={`slide${locked ? " slide-locked" : ""}`}
      data-tone={spec.tone}
      aria-label={locked ? undefined : [spec.kicker, spec.bubble, spec.headline, spec.body].filter(Boolean).join(". ")}
    >
      <div className="slide-top">
        <span>{BRAND} {year}</span>
        <span>
          {index + 1}/{total}
        </span>
      </div>
      <div className="slide-kicker">{spec.kicker}</div>
      {spec.bubble && <div className="slide-bubble">{spec.bubble}</div>}
      {spec.headline && (
        <div className="slide-headline" data-long={long}>
          {spec.headline}
        </div>
      )}
      {spec.body && <p className="slide-body">{spec.body}</p>}
      {spec.rows && (
        <div className="slide-rows">
          {spec.rows.map(([label, value], i) => (
            <div className="slide-row" key={i}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="slide-mark">{BRAND_LOWER}</div>
      {locked && (
        <div className="slide-lock" aria-hidden="true">
          🔒
        </div>
      )}
    </div>
  );
});
