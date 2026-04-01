"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  plan: string;
}

export default function CommunityCard({ plan }: Props) {
  const [loading, setLoading] = useState(false);
  const hasAccess = plan === "pro" || plan === "school";

  async function handleJoin() {
    setLoading(true);
    trackEvent("community_visited");
    try {
      const res = await fetch("/api/community/join-url");
      const data = await res.json();
      if (data.ssoUrl) {
        window.open(data.ssoUrl, "_blank");
      } else if (data.communityUrl) {
        window.open(data.communityUrl, "_blank");
      }
    } catch { /* */ }
    setLoading(false);
  }

  if (hasAccess) {
    return (
      <div className="card" style={{ borderColor: "#1a6b4a", borderWidth: 2 }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">&#127775;</span>
          <div>
            <h3 className="font-bold text-gray-900">Noor Families Community</h3>
            <p className="text-xs text-gray-500">Private community for {plan === "school" ? "School" : "Pro"} members</p>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-500 mb-4">
          <span>&#128101; 847 members</span>
          <span>&#128221; 234 posts</span>
          <span>&#128197; Next Q&A: Tuesday 8pm</span>
        </div>

        <button onClick={handleJoin} disabled={loading} className="btn-primary w-full" style={{ backgroundColor: "#1a6b4a" }}>
          {loading ? "Opening..." : "Enter Community \u2192"}
        </button>
      </div>
    );
  }

  // Free user — upsell
  return (
    <div className="card" style={{ backgroundColor: "#faf9f5" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">&#128274;</span>
        <div>
          <h3 className="font-bold text-gray-900">Noor Families Community</h3>
          <p className="text-xs text-gray-500">Join 847 Muslim families</p>
        </div>
      </div>

      <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
        <li>&#10003; Weekly live Islamic Q&A</li>
        <li>&#10003; Share kids&apos; colored worksheets</li>
        <li>&#10003; Ramadan challenge group</li>
        <li>&#10003; Islamic parenting discussions</li>
        {plan !== "school" && <li>&#10003; Teachers Lounge (School plan)</li>}
      </ul>

      <a href="/dashboard" className="btn-gold w-full text-center block" style={{ padding: "10px", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
        Upgrade to Pro &mdash; $12/month &rarr;
      </a>
    </div>
  );
}
