"use client";

import { useState, useEffect } from "react";

interface Post {
  authorName: string;
  preview: string;
}

export default function RecentActivity() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    // Use mock data — in production, call Circle API via our API
    setPosts([
      { authorName: "Fatima A.", preview: "My daughter loved this week's mosque coloring page! She colored it..." },
      { authorName: "Ahmed K.", preview: "Weekly theme suggestion: Let's do Arabic calligraphy this week!" },
      { authorName: "Sara M.", preview: "Masha'Allah! Look at my son's completed Ramadan maze worksheet..." },
    ]);
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="card">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent in Community</p>
      <div className="space-y-3">
        {posts.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: "#e8f5ec", color: "#1a6b4a" }}>
              {p.authorName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900">{p.authorName}</p>
              <p className="text-xs text-gray-500 truncate">{p.preview}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={async () => {
        const res = await fetch("/api/community/join-url");
        const data = await res.json();
        if (data.ssoUrl) window.open(data.ssoUrl, "_blank");
      }} className="text-xs mt-3 hover:underline" style={{ color: "#1a6b4a" }}>
        Join the conversation &rarr;
      </button>
    </div>
  );
}
