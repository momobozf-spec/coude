"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  overview: {
    totalUsers: number;
    signupsToday: number;
    signupsWeek: number;
    signupsMonth: number;
    mrr: number;
    mrrYearlyEstimate: number;
  };
  plans: { free: number; pro: number; school: number };
  generations: { total: number; today: number; week: number };
  leads: { total: number; week: number };
  funnel: {
    totalSignups: number;
    activated: number;
    activationRate: string;
    paid: number;
    conversionRate: string;
  };
  topReferrers: { name: string; email: string; referralCount: number; bonusGenerations: number }[];
  topThemes: { theme: string; count: number }[];
  recentSignups: { name: string; email: string; plan: string; createdAt: string; referredBy: string | null }[];
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) { setError("Failed to load stats"); return; }
      const data = await res.json();
      setStats(data);
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa", fontFamily: "Inter, sans-serif" }}>
        <p style={{ color: "#666" }}>Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) return <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter, sans-serif" }}>Loading...</div>;

  const S: React.CSSProperties = { fontFamily: "Inter, sans-serif", background: "#f8f9fa", minHeight: "100vh", padding: "24px 16px" };
  const Card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e4dc" };
  const Grid: React.CSSProperties = { display: "grid", gap: 16, marginBottom: 24 };

  return (
    <div style={S}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a6b4a" }}>&#127769; Noor Printables — Admin</h1>
          <button onClick={() => fetchStats()} style={{ padding: "8px 16px", background: "#1a6b4a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            &#8635; Refresh
          </button>
        </div>

        {/* KPI Row */}
        <div style={{ ...Grid, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {[
            { label: "Total Users", value: stats.overview.totalUsers, color: "#333" },
            { label: "MRR", value: `$${stats.overview.mrr}`, color: "#1a6b4a" },
            { label: "ARR (est.)", value: `$${stats.overview.mrrYearlyEstimate.toLocaleString()}`, color: "#1a6b4a" },
            { label: "Signups Today", value: stats.overview.signupsToday, color: "#2563eb" },
            { label: "Signups (7d)", value: stats.overview.signupsWeek, color: "#2563eb" },
            { label: "Signups (30d)", value: stats.overview.signupsMonth, color: "#2563eb" },
          ].map((kpi, i) => (
            <div key={i} style={{ ...Card, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Plan Breakdown + Funnel */}
        <div style={{ ...Grid, gridTemplateColumns: "1fr 1fr" }}>
          <div style={Card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Plan Breakdown</h3>
            {[
              { label: "Free", count: stats.plans.free, color: "#94a3b8", pct: stats.overview.totalUsers ? (stats.plans.free / stats.overview.totalUsers * 100).toFixed(0) : 0 },
              { label: "Pro", count: stats.plans.pro, color: "#1a6b4a", pct: stats.overview.totalUsers ? (stats.plans.pro / stats.overview.totalUsers * 100).toFixed(0) : 0 },
              { label: "School", count: stats.plans.school, color: "#c9920a", pct: stats.overview.totalUsers ? (stats.plans.school / stats.overview.totalUsers * 100).toFixed(0) : 0 },
            ].map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
                <span style={{ fontSize: 13, flex: 1 }}>{p.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{p.count}</span>
                <span style={{ fontSize: 12, color: "#999" }}>({p.pct}%)</span>
              </div>
            ))}
          </div>
          <div style={Card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Conversion Funnel</h3>
            {[
              { label: "Signups", value: stats.funnel.totalSignups, sub: "" },
              { label: "Activated (1+ gen)", value: stats.funnel.activated, sub: stats.funnel.activationRate },
              { label: "Paid", value: stats.funnel.paid, sub: stats.funnel.conversionRate },
            ].map((s2, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? "1px solid #f0f0f0" : "none" }}>
                <span style={{ fontSize: 13 }}>{s2.label}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{s2.value}</span>
                  {s2.sub && <span style={{ fontSize: 12, color: "#1a6b4a", marginLeft: 6 }}>{s2.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generations + Leads */}
        <div style={{ ...Grid, gridTemplateColumns: "1fr 1fr" }}>
          <div style={Card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Generations</h3>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#333" }}>{stats.generations.total}</div>
            <div style={{ fontSize: 12, color: "#999" }}>Today: {stats.generations.today} · This week: {stats.generations.week}</div>
          </div>
          <div style={Card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Email Leads</h3>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#333" }}>{stats.leads.total}</div>
            <div style={{ fontSize: 12, color: "#999" }}>This week: {stats.leads.week}</div>
          </div>
        </div>

        {/* Top Themes + Top Referrers */}
        <div style={{ ...Grid, gridTemplateColumns: "1fr 1fr" }}>
          <div style={Card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Top Themes</h3>
            {stats.topThemes.length === 0 ? (
              <p style={{ fontSize: 13, color: "#999" }}>No generations yet</p>
            ) : (
              stats.topThemes.map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <span>{i + 1}. {t.theme}</span>
                  <span style={{ fontWeight: 600 }}>{t.count}</span>
                </div>
              ))
            )}
          </div>
          <div style={Card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Top Referrers</h3>
            {stats.topReferrers.length === 0 ? (
              <p style={{ fontSize: 13, color: "#999" }}>No referrals yet</p>
            ) : (
              stats.topReferrers.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <span>{r.name} <span style={{ color: "#999" }}>({r.email})</span></span>
                  <span style={{ fontWeight: 600, color: "#1a6b4a" }}>{r.referralCount} refs</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Signups */}
        <div style={Card}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12 }}>Recent Signups</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8e4dc" }}>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#999", fontWeight: 600 }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#999", fontWeight: 600 }}>Email</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#999", fontWeight: 600 }}>Plan</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#999", fontWeight: 600 }}>Referred</th>
                  <th style={{ textAlign: "left", padding: "8px 4px", color: "#999", fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSignups.map((u, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px 4px" }}>{u.name}</td>
                    <td style={{ padding: "8px 4px", color: "#666" }}>{u.email}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: u.plan === "school" ? "#fdf3d7" : u.plan === "pro" ? "#e8f5ec" : "#f3f4f6",
                        color: u.plan === "school" ? "#c9920a" : u.plan === "pro" ? "#1a6b4a" : "#666",
                      }}>{u.plan.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: "8px 4px", color: "#666" }}>{u.referredBy || "—"}</td>
                    <td style={{ padding: "8px 4px", color: "#999" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
