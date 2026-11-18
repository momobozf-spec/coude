"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BRAND, BRAND_SLUG } from "@/lib/brand";
import { SlideCard } from "./SlideCard";
import type { SlideSpec } from "@/lib/slides";
import { getDict, type Locale } from "@/i18n/dictionaries";

const PLACEHOLDER: Omit<SlideSpec, "key" | "tone"> = {
  kicker: BRAND,
  headline: "████████",
  body: "████ ██████ ████ ███████ ████ ██",
};

function useScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(1, (window.innerWidth - 56) / 360));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

async function renderPng(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, { pixelRatio: 3, cacheBust: true, style: { transform: "none", borderRadius: "0" } });
  if (!blob) throw new Error("render_failed");
  return blob;
}

function noopSubscribe() {
  return () => {};
}

function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob()], "x.png", { type: "image/png" });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface Props {
  slides: SlideSpec[];
  year: number;
  locale: Locale;
  /** Number of slides shown unlocked; the rest render as locked placeholders. */
  unlocked?: number;
  actions?: boolean;
}

export function SlideDeck({ slides, year, locale, unlocked = slides.length, actions = false }: Props) {
  const t = getDict(locale).result;
  const scale = useScale();
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noopSubscribe, canShareFiles, () => false);

  const fileName = (i: number) => `${BRAND_SLUG}-${year}-${String(i + 1).padStart(2, "0")}.png`;

  async function download(i: number) {
    const node = refs.current[i];
    if (!node) return;
    setBusy(`one-${i}`);
    try {
      saveBlob(await renderPng(node), fileName(i));
    } finally {
      setBusy(null);
    }
  }

  async function share(i: number) {
    const node = refs.current[i];
    if (!node) return;
    setBusy(`share-${i}`);
    try {
      const blob = await renderPng(node);
      await navigator.share({ files: [new File([blob], fileName(i), { type: "image/png" })] });
    } catch {
      // User cancelled the share sheet; nothing to do.
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setBusy("all");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < Math.min(unlocked, slides.length); i++) {
        const node = refs.current[i];
        if (node) zip.file(fileName(i), await renderPng(node));
      }
      saveBlob(await zip.generateAsync({ type: "blob" }), `${BRAND_SLUG}-${year}.zip`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {actions && (
        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadAll}
            disabled={busy !== null}
            className="rounded-full bg-ink px-5 py-3 font-bold text-cream disabled:opacity-50"
          >
            {busy === "all" ? "…" : t.downloadAll}
          </button>
        </div>
      )}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6"
        role="region"
        aria-label={`${BRAND} ${year}`}
        tabIndex={0}
      >
        {slides.map((spec, i) => {
          const locked = i >= unlocked;
          const shown = locked ? { ...spec, ...PLACEHOLDER, bubble: undefined, rows: undefined } : spec;
          return (
            <div key={spec.key} className="flex snap-center flex-col items-center gap-3">
              <div style={{ width: 360 * scale, height: 640 * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <SlideCard
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    spec={shown}
                    index={i}
                    total={slides.length}
                    year={year}
                    locked={locked}
                  />
                </div>
              </div>
              {actions && !locked && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => download(i)}
                    disabled={busy !== null}
                    className="rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold disabled:opacity-50"
                  >
                    {busy === `one-${i}` ? "…" : t.download}
                  </button>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => share(i)}
                      disabled={busy !== null}
                      className="rounded-full bg-pink px-4 py-1.5 text-sm font-bold text-grape disabled:opacity-50"
                    >
                      {busy === `share-${i}` ? "…" : t.share}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
