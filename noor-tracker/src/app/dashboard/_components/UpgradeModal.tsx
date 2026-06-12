"use client";

import { useState } from "react";

interface UpgradeModalProps {
  onClose: () => void;
  message?: string;
}

export function UpgradeModal({
  onClose,
  message = "Upgrade naar Pro om meer functies te ontgrendelen.",
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-3xl p-8 w-full max-w-md relative z-10 shadow-2xl animate-bounce-in text-center">
        <div className="text-5xl mb-4">{"\u2B50"}</div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-2">
          Upgrade naar Pro
        </h2>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="bg-emerald-50 rounded-2xl p-4 mb-6">
          <div className="text-2xl font-extrabold text-emerald-700">
            {"\u20AC"}4,99
            <span className="text-sm font-normal text-gray-500">/maand</span>
          </div>
          <ul className="text-sm text-gray-600 mt-3 space-y-1">
            <li>{"\u2713"} 3 kinderen</li>
            <li>{"\u2713"} 14+ gewoontes</li>
            <li>{"\u2713"} Volledige geschiedenis</li>
            <li>{"\u2713"} Wekelijks e-mail rapport</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Laden..." : "Upgrade nu"}
          </button>
        </div>
      </div>
    </div>
  );
}
