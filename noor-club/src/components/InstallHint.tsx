"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { dismissInstallHint } from "@/actions/install";
import { Button } from "@/components/ui/Button";

/** Chromium's install prompt event, which lib.dom does not declare. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** iOS Safari's non-standard standalone flag. */
type StandaloneNavigator = Navigator & { standalone?: boolean };

type Platform = "none" | "ios" | "android";

/**
 * Nudges the parent to install the app, once.
 *
 * The server only renders this after the child has finished at least one game —
 * asking someone to install an app they have not tried yet is how you get told
 * no. iOS has no install prompt at all, so there it explains the Share sheet by
 * hand; Chromium hands us `beforeinstallprompt` and gets a real button.
 */
export function InstallHint() {
  const t = useTranslations("install");

  const [platform, setPlatform] = useState<Platform>("none");
  const [hidden, setHidden] = useState(false);
  const promptEvent = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed: nothing to suggest.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as StandaloneNavigator).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && window.navigator.maxTouchPoints > 1);
    // Chrome/Firefox/Edge on iOS cannot add to the home screen at all.
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIOS && isSafari) setPlatform("ios");
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      promptEvent.current = event as BeforeInstallPromptEvent;
      setPlatform("android");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const close = useCallback(() => {
    setHidden(true);
    void dismissInstallHint();
  }, []);

  const install = useCallback(async () => {
    const event = promptEvent.current;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setHidden(true);
    void dismissInstallHint();
  }, []);

  if (hidden || platform === "none") return null;

  return (
    <section
      aria-labelledby="install-hint-title"
      className="rounded-card border-2 border-gold bg-gold-light p-5 md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="install-hint-title"
            className="text-lg font-extrabold text-emerald-dark md:text-xl"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 md:text-base">
            {t("body")}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("dismiss")}
          className="tap-target shrink-0 rounded-full px-3 text-2xl leading-none text-slate-500 hover:bg-white/60"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {platform === "ios" ? (
        <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <li className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3">
            {/* iOS share glyph: a box with an arrow leaving the top. */}
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 text-emerald"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 15V3" />
              <path d="m8 7 4-4 4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            <span className="text-sm font-bold text-emerald-dark">{t("iosStep1")}</span>
          </li>
          <li className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3">
            {/* "Add to Home Screen": a square with a plus inside. */}
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 text-emerald"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            <span className="text-sm font-bold text-emerald-dark">{t("iosStep2")}</span>
          </li>
        </ol>
      ) : (
        <div className="mt-4">
          <Button variant="gold" size="lg" onClick={install}>
            {t("androidCta")}
          </Button>
        </div>
      )}

      <div className="mt-5 border-t border-gold/30 pt-4">
        <p className="text-sm font-extrabold text-emerald-dark">{t("guidedTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{t("guidedBody")}</p>
      </div>
    </section>
  );
}
