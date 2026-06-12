"use client";

import { FormEvent, useState } from "react";
import { AVATAR_OPTIONS } from "@/lib/habits";

interface AddChildModalProps {
  onClose: () => void;
  onAdded: () => void;
}

export function AddChildModal({ onClose, onAdded }: AddChildModalProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState(5);
  const [avatar, setAvatar] = useState("star");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, age, avatar }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-3xl p-8 w-full max-w-md relative z-10 shadow-2xl animate-bounce-in">
        <h2 className="text-xl font-extrabold text-gray-900 mb-6">
          Kind toevoegen
        </h2>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naam
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
              placeholder="Naam van je kind"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leeftijd
            </label>
            <select
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => i + 4).map((a) => (
                <option key={a} value={a}>
                  {a} jaar
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setAvatar(opt.slug)}
                  className={`text-3xl p-3 rounded-xl border-2 transition-all ${
                    avatar === opt.slug
                      ? "border-emerald-500 bg-emerald-50 scale-110"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Toevoegen..." : "Toevoegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
