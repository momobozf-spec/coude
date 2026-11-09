"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useI18n } from "@/i18n/context";

// Consent banner. Only strictly necessary cookies (Auth.js session/CSRF) are set without
// consent. Google Analytics is loaded ONLY after an explicit "accept" and only when
// NEXT_PUBLIC_GA_ID is configured. The choice is stored in localStorage (no cookie).

const STORAGE_KEY = "noor-cookie-consent"; // "accepted" | "rejected"
const OPEN_EVENT = "noor-open-cookie-settings";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GA_ENABLED = !!GA_ID && GA_ID !== "G-XXXXXXXXXX";

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function readChoice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const { t } = useI18n();
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = readChoice();
    // Sync from localStorage once after mount (not available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(stored);
    setOpen(GA_ENABLED && !stored);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function decide(value: "accepted" | "rejected") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    const wasAccepted = choice === "accepted";
    setChoice(value);
    setOpen(false);
    // Withdrawing consent: reload so the analytics script is no longer present.
    if (wasAccepted && value === "rejected") window.location.reload();
  }

  return (
    <>
      {GA_ENABLED && choice === "accepted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {open && (
        <div className="fixed bottom-0 inset-x-0 z-[100] p-4" role="dialog" aria-live="polite">
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 shadow-lg rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <p className="text-sm text-gray-600 flex-1">
              {t("cookie.text")}{" "}
              <Link href="/cookies" className="underline">{t("legal.cookies")}</Link>
            </p>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => decide("rejected")} className="btn-secondary text-sm px-3 py-2">
                {t("cookie.reject")}
              </button>
              {GA_ENABLED && (
                <button type="button" onClick={() => decide("accepted")} className="btn-primary text-sm px-3 py-2">
                  {t("cookie.accept")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
