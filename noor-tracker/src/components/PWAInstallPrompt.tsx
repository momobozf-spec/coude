"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as unknown as { standalone: boolean }).standalone);

    setIsStandalone(!!standalone);

    if (standalone) return;

    // Detect iOS
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    // Check if user dismissed before (cooldown: 3 days)
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
    }

    // Android/desktop: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show after 30 seconds of use
    if (ios) {
      const timer = setTimeout(() => setShowPrompt(true), 30000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-emerald-700 rounded-xl flex items-center justify-center text-2xl shrink-0">
            {"\u2B50"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm">
              Installeer Noor Tracker
            </h3>
            {isIOS ? (
              <p className="text-xs text-gray-600 mt-1">
                Tik op{" "}
                <span className="inline-flex items-center">
                  <svg
                    className="w-4 h-4 inline text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </span>{" "}
                en dan &ldquo;Zet op beginscherm&rdquo;
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-1">
                Voeg toe aan je beginscherm voor snelle toegang
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 shrink-0 p-1"
            aria-label="Sluiten"
          >
            {"\u2715"}
          </button>
        </div>

        {!isIOS && deferredPrompt && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 text-sm py-2 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 text-sm py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors"
            >
              Installeren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
