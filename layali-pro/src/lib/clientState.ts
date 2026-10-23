"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * true zodra de component in de browser draait (na hydratatie), false op de
 * server. Vervangt het patroon `useEffect(() => setMounted(true))`, dat een
 * extra render veroorzaakt.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// ── Cookietoestemming ──────────────────────────────────────────────────────

const CONSENT_KEY = "jj-cookie-consent";
const CONSENT_EVENT = "layali:consent";

export type Consent = "accepted" | "declined" | null;

function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

function subscribeConsent(callback: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Toestemming voor niet-noodzakelijke cookies; "unknown" op de server. */
export function useConsent(): Consent | "unknown" {
  return useSyncExternalStore<Consent | "unknown">(subscribeConsent, readConsent, () => "unknown");
}

export function setConsent(value: "accepted" | "declined"): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Opslag geblokkeerd: de keuze geldt dan alleen voor deze pagina.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
