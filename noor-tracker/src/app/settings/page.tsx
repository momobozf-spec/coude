"use client";

import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AVATAR_OPTIONS, getAvatarEmoji } from "@/lib/habits";

interface Child {
  id: string;
  name: string;
  age: number;
  avatar: string;
}

const CHILD_AGES = [4, 5, 6, 7, 8];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState(5);
  const [editAvatar, setEditAvatar] = useState("star");
  const [billingLoading, setBillingLoading] = useState(false);

  const plan = session?.user?.plan ?? "free";

  const fetchChildren = useCallback(async () => {
    const res = await fetch("/api/children");
    if (res.ok) {
      setChildren(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  function startEdit(child: Child) {
    setEditingChild(child.id);
    setEditName(child.name);
    setEditAge(child.age);
    setEditAvatar(child.avatar);
  }

  async function saveChild(childId: string) {
    await fetch(`/api/children/${childId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, age: editAge, avatar: editAvatar }),
    });
    setEditingChild(null);
    fetchChildren();
  }

  async function deleteChild(childId: string) {
    if (!confirm("Weet je zeker dat je dit kind wilt verwijderen? Dit kan niet ongedaan worden.")) {
      return;
    }

    await fetch(`/api/children/${childId}`, { method: "DELETE" });
    fetchChildren();
  }

  async function openBillingPortal() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleUpgrade() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-3xl p-6 border border-emerald-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-500">Naam</p>
              <p className="font-medium">{session?.user?.name ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-500">E-mail</p>
              <p className="font-medium">{session?.user?.email ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-medium flex items-center gap-2">
                {plan === "pro" ? (
                  <>
                    <span className="bg-gold-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      PRO
                    </span>
                    Pro
                  </>
                ) : (
                  "Gratis"
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl p-6 border border-emerald-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Abonnement</h2>
        {plan === "pro" ? (
          <div>
            <p className="text-gray-600 text-sm mb-4">
              Je hebt een Pro abonnement. Beheer je betaling via Stripe.
            </p>
            <button
              onClick={openBillingPortal}
              disabled={billingLoading}
              className="bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {billingLoading ? "Laden..." : "Abonnement beheren"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 text-sm mb-4">
              Upgrade naar Pro voor meerdere kinderen, alle gewoontes, badges en
              wekelijkse rapporten.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={billingLoading}
              className="bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {billingLoading ? "Laden..." : "Upgrade naar Pro - EUR 4,99/maand"}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 border border-emerald-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Kinderen</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : children.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Je hebt nog geen kinderen toegevoegd.
          </p>
        ) : (
          <div className="space-y-4">
            {children.map((child) => (
              <div
                key={child.id}
                className="border border-gray-200 rounded-2xl p-4"
              >
                {editingChild === child.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none"
                    />
                    <select
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none"
                    >
                      {CHILD_AGES.map((age) => (
                        <option key={age} value={age}>
                          {age} jaar
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-4 gap-1">
                      {AVATAR_OPTIONS.map((opt) => (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => setEditAvatar(opt.slug)}
                          className={`text-2xl p-2 rounded-lg border ${
                            editAvatar === opt.slug
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-gray-200"
                          }`}
                        >
                          {opt.emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingChild(null)}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50"
                      >
                        Annuleren
                      </button>
                      <button
                        onClick={() => saveChild(child.id)}
                        className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800"
                      >
                        Opslaan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">
                        {getAvatarEmoji(child.avatar)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{child.name}</p>
                        <p className="text-sm text-gray-500">{child.age} jaar</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(child)}
                        className="text-sm text-emerald-700 font-medium hover:underline"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => deleteChild(child.id)}
                        className="text-sm text-red-600 font-medium hover:underline"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 border border-red-100">
        <h2 className="text-lg font-bold text-red-600 mb-4">Gevarenzone</h2>
        <p className="text-gray-600 text-sm mb-4">
          Als je uitlogt, kun je altijd weer inloggen met hetzelfde account.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="bg-red-50 text-red-700 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors"
        >
          Uitloggen
        </button>
      </section>
    </div>
  );
}
