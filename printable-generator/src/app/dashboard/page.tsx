"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "@/i18n/context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { PLANS } from "@/lib/plans";

interface UserData {
  id: string;
  name: string;
  email: string;
  plan: string;
  generationsCount: number;
  bonusGenerations: number;
  stripeCustomerId: string | null;
}

interface ReferralData {
  code: string;
  referralCount: number;
  bonusGenerations: number;
}

type ActivityType = "coloring" | "maze" | "wordsearch";

const SUGGESTED_THEMES: Record<string, string[]> = {
  ramadan: ["Ramadan Mubarak", "Iftar Table", "Ramadan Lantern", "Crescent Moon", "Taraweeh Prayer"],
  eid: ["Eid al-Fitr", "Eid al-Adha", "Eid Gifts", "Eid Decorations"],
  arabic: ["Arabic Letters Alif-Ba", "Arabic Numbers", "Bismillah"],
  values: ["Kindness", "Sharing", "Patience (Sabr)", "Gratitude (Shukr)", "Honesty"],
  islamic: ["Mosque", "Kaaba", "Quran", "Five Pillars", "Dua Hands"],
  general: ["Animals", "Nature", "Shapes & Colors", "Fruits", "Family"],
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t } = useI18n();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>("coloring");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/user");
      if (!res.ok) return;
      const data = await res.json();
      setUserData(data.user);
    } catch { /* */ }
  }, []);

  const fetchReferral = useCallback(async () => {
    try {
      const res = await fetch("/api/referral");
      if (res.ok) {
        const data = await res.json();
        setReferral(data);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUser();
      fetchReferral();
    }
  }, [session, fetchUser, fetchReferral]);

  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    if (upgraded) {
      setSuccess(`Upgraded to ${upgraded === "school" ? "School" : "Pro"}! Unlimited sheets unlocked.`);
      trackEvent("checkout_complete", { plan: upgraded });
      fetchUser();
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams, fetchUser]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType, theme }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.limitReached) {
          setError("");
          trackEvent("limit_reached", { plan: userData?.plan });
          // Show upgrade prompt instead of error
          setShowUpgradeModal(true);
          return;
        }
        setError(data.error || t("error.generic"));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noor-${activityType}-${theme.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      trackEvent("download_pdf", { activityType, theme });
      setSuccess(t("dash.generate.success"));
      fetchUser();
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  async function handleUpgrade(priceKey: string) {
    setUpgradeLoading(true);
    setError("");
    trackEvent("checkout_start", { priceKey });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError(t("error.upgradeFailed")); setUpgradeLoading(false); }
    } catch {
      setError(t("error.upgradeFailed"));
      setUpgradeLoading(false);
    }
  }

  async function handleManageSubscription() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setError(t("error.generic")); }
  }

  function copyReferralLink() {
    if (!referral) return;
    const url = `${window.location.origin}/register?ref=${referral.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    trackEvent("referral_share");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!session || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  const limit = userData.plan === "free"
    ? PLANS.free.generationLimit + userData.bonusGenerations
    : Infinity;
  const remaining = limit === Infinity ? "Unlimited" : `${Math.max(0, limit - userData.generationsCount)}`;
  const usagePercent = limit === Infinity ? 0 : Math.min(100, (userData.generationsCount / limit) * 100);
  const isNearLimit = userData.plan === "free" && limit - userData.generationsCount <= 1;

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "#0d9488" }}>Noor Printables</h1>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="text-sm text-gray-500 hidden sm:inline">{userData.name}</span>
            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
              backgroundColor: userData.plan === "school" ? "#fdf8ef" : userData.plan === "pro" ? "#ecfdf5" : "#f3f4f6",
              color: userData.plan === "school" ? "#d4a843" : userData.plan === "pro" ? "#0d9488" : "#6b7280",
            }}>
              {userData.plan.toUpperCase()}
            </span>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm text-gray-500 hover:text-gray-700">
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <p className="text-gray-500 mb-6">{t("dash.greeting")}</p>

        {/* Upgrade banner for free users */}
        {userData.plan === "free" && (
          <div className="rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}>
            <div className="text-white">
              <p className="font-bold">Unlock unlimited Islamic printables</p>
              <p className="text-sm text-teal-100">Pro plan from $8/mo &middot; School plan from $33/mo</p>
            </div>
            <button onClick={() => handleUpgrade("pro_yearly")} disabled={upgradeLoading} className="bg-white font-bold px-6 py-2 rounded-lg text-sm whitespace-nowrap" style={{ color: "#0d9488" }}>
              {upgradeLoading ? "..." : "Upgrade Now"}
            </button>
          </div>
        )}

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card text-center" style={{ borderColor: "#0d9488", borderWidth: 2 }}>
            <div className="text-2xl mb-1">&#128438;</div>
            <h3 className="font-semibold text-gray-900">{t("dash.mode.printable")}</h3>
            <p className="text-xs text-gray-500 mt-1">{t("dash.mode.printable.desc")}</p>
          </div>
          <Link href="/color" className="card text-center hover:shadow-md transition-all group">
            <div className="text-2xl mb-1">&#127912;</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-teal-600">{t("dash.mode.digital")}</h3>
            <p className="text-xs text-gray-500 mt-1">{t("dash.mode.digital.desc")}</p>
          </Link>
        </div>

        {/* Stats + Usage bar */}
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-sm text-gray-500">Sheets used</p>
              <p className="text-2xl font-bold text-gray-900">{userData.generationsCount} <span className="text-sm font-normal text-gray-400">/ {limit === Infinity ? "&#8734;" : limit}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Remaining</p>
              <p className="text-2xl font-bold" style={{ color: isNearLimit ? "#ef4444" : "#0d9488" }}>{remaining}</p>
            </div>
          </div>
          {userData.plan === "free" && (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${usagePercent}%`,
                backgroundColor: usagePercent > 80 ? "#ef4444" : "#0d9488",
              }} />
            </div>
          )}
          {isNearLimit && (
            <p className="text-xs mt-2" style={{ color: "#ef4444" }}>
              Almost out! <button onClick={() => handleUpgrade("pro_yearly")} className="underline font-medium">Upgrade to Pro</button> or <button onClick={() => setShowReferral(true)} className="underline font-medium">invite friends</button> for 5 free sheets each.
            </p>
          )}
          {userData.plan !== "free" && (
            <button onClick={handleManageSubscription} className="text-xs mt-2 hover:underline" style={{ color: "#0d9488" }}>
              Manage subscription
            </button>
          )}
        </div>

        {/* Generator */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t("dash.generate.title")}</h2>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#ecfdf5", color: "#0d9488" }}>{success}</div>}

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("dash.generate.type")}</label>
              <select className="input-field" value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)}>
                <option value="coloring">{t("dash.generate.type.coloring")}</option>
                <option value="maze">{t("dash.generate.type.maze")}</option>
                <option value="wordsearch">{t("dash.generate.type.wordsearch")}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("dash.generate.theme")}</label>
              <input type="text" className="input-field" value={theme} onChange={(e) => setTheme(e.target.value)} required maxLength={100} placeholder={t("dash.generate.placeholder")} />
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">{t("dash.generate.quickThemes")}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(SUGGESTED_THEMES).flat().slice(0, 10).map((thm) => (
                  <button key={thm} type="button" className="theme-chip" onClick={() => setTheme(thm)}>{thm}</button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full text-lg py-3" disabled={loading || !theme.trim()}>
              {loading ? t("dash.generate.loading") : t("dash.generate.submit")}
            </button>
          </form>
        </div>

        {/* Referral section */}
        <div className="card mb-6">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => { setShowReferral(!showReferral); if (!showReferral) fetchReferral(); }}>
            <div>
              <h3 className="font-bold text-gray-900">Invite Friends &mdash; Get Free Sheets</h3>
              <p className="text-xs text-gray-500">Earn 5 bonus sheets for every friend who signs up</p>
            </div>
            <span className="text-gray-400">{showReferral ? "&#9650;" : "&#9660;"}</span>
          </div>

          {showReferral && referral && (() => {
            const refUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referral.code}`;
            const waMsg = encodeURIComponent(`Assalamu Alaikum! Ik gebruik Noor Printables voor Islamitische kleurplaten en werkbladen voor mijn kinderen. Probeer het gratis: ${refUrl}`);
            const emailSubject = encodeURIComponent("Islamitische kleurplaten voor je kinderen");
            const emailBody = encodeURIComponent(`Assalamu Alaikum!\n\nIk wilde Noor Printables met je delen - een platform voor Islamitische kleurplaten, doolhoven en woordzoekers voor kinderen van 4-8 jaar.\n\nProbeer het gratis via mijn link: ${refUrl}\n\nWe krijgen allebei 5 gratis werkbladen!`);
            return (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex gap-2 mb-3">
                  <input type="text" readOnly className="input-field flex-1 text-sm bg-gray-50" value={refUrl} />
                  <button onClick={copyReferralLink} className="btn-primary text-sm px-4">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                {/* Share buttons */}
                <div className="flex gap-2 mb-4">
                  <a
                    href={`https://wa.me/?text=${waMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: "#25D366" }}
                    onClick={() => trackEvent("referral_share", { channel: "whatsapp" })}
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white bg-gray-600"
                    onClick={() => trackEvent("referral_share", { channel: "email" })}
                  >
                    &#9993; Email
                  </a>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: "Noor Printables", text: "Islamitische kleurplaten voor kinderen", url: refUrl });
                        trackEvent("referral_share", { channel: "native" });
                      } else {
                        copyReferralLink();
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium btn-outline"
                  >
                    &#128279; Share
                  </button>
                </div>

                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Friends referred:</span>{" "}
                    <span className="font-bold text-gray-900">{referral.referralCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bonus sheets earned:</span>{" "}
                    <span className="font-bold" style={{ color: "#0d9488" }}>{referral.bonusGenerations}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Theme browser */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("dash.browse")}</h3>
          {Object.entries(SUGGESTED_THEMES).map(([category, themes]) => (
            <div key={category} className="mb-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{t(`themes.${category}`)}</p>
              <div className="flex flex-wrap gap-1.5">
                {themes.map((thm) => (
                  <button key={thm} type="button" className="theme-chip" onClick={() => setTheme(thm)}>{thm}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;ve used all your free sheets!</h2>
            <p className="text-sm text-gray-500 mb-6">Upgrade to continue creating Islamic educational activities.</p>

            <div className="space-y-3 mb-6">
              <button onClick={() => handleUpgrade("pro_yearly")} className="btn-primary w-full py-3">
                Get Pro &mdash; $8/mo (billed yearly)
              </button>
              <button onClick={() => handleUpgrade("school_yearly")} className="btn-gold w-full py-3">
                Get School &mdash; $33/mo (25 teachers)
              </button>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>Or <button onClick={() => { setShowUpgradeModal(false); setShowReferral(true); }} className="underline" style={{ color: "#0d9488" }}>invite friends</button> for 5 free sheets each</p>
            </div>

            <button onClick={() => setShowUpgradeModal(false)} className="mt-4 text-xs text-gray-400 w-full text-center">
              Maybe later
            </button>
          </div>
        </div>
      )}

      <footer className="text-center py-6 text-sm text-gray-400">
        {t("footer.text")} &copy; 2026
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="flex items-center gap-2 text-gray-500"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />Loading...</div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
