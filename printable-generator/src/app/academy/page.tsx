"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface CourseItem {
  id: string; slug: string; title: string; titleAr: string; description: string;
  thumbnail: string; price: number; currency: string; languages: string[];
  category: string; totalLessons: number; totalMinutes: number; isFeatured: boolean;
  avgRating: number | null; reviewCount: number; enrolled: boolean; completed: boolean;
  trailerUrl: string | null;
}

const CATEGORIES = ["All", "Quran", "Arabic Letters", "Islamic Values", "Ramadan"];

export default function AcademyPage() {
  const { data: session } = useSession();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/academy/courses").then(r => r.json()).then(d => {
      setCourses(d.courses || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = filter === "All" ? courses : courses.filter(c => c.category === filter);
  const featured = courses.find(c => c.isFeatured);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fdf8f0" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#1a6b4a" }}>Noor Printables</Link>
          <div className="flex gap-2">
            <Link href="/dashboard" className="btn-outline text-sm">Dashboard</Link>
            {session ? (
              <Link href="/academy/my-courses" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>My Courses</Link>
            ) : (
              <Link href="/register" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>Start Free</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-12 pb-8 text-center">
        <p className="text-sm font-medium mb-2" style={{ color: "#c9920a" }}>&#127891; NOOR ACADEMY</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: "'Amiri', serif" }}>
          Learn Islam Through Fun Videos
        </h1>
        <p className="text-lg text-gray-400 mb-1" style={{ fontFamily: "'Amiri', serif" }}>تعلم مع نور</p>
        <p className="text-gray-600 max-w-xl mx-auto">
          Interactive video courses for Muslim kids aged 4-8. Arabic letters, Ramadan stories, Islamic values &amp; more.
        </p>
      </section>

      {/* Featured course */}
      {featured && (
        <section className="px-4 pb-8">
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1a6b4a, #145239)" }}>
            <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center">
              <div className="flex-1 text-white">
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#c9920a" }}>&#11088; FEATURED</span>
                <h2 className="text-2xl font-bold mt-3 mb-1">{featured.title}</h2>
                <p className="text-sm text-green-200 mb-1" style={{ fontFamily: "'Amiri', serif" }}>{featured.titleAr}</p>
                <p className="text-sm text-green-100/80 mb-4">{featured.description.slice(0, 120)}...</p>
                <div className="flex gap-3 text-xs text-green-200">
                  <span>{featured.totalLessons} lessons</span>
                  <span>&middot;</span>
                  <span>{Math.floor(featured.totalMinutes / 60)}h {featured.totalMinutes % 60}m</span>
                  <span>&middot;</span>
                  <span>{featured.languages.join(", ")}</span>
                </div>
                <Link href={`/academy/${featured.slug}`} className="inline-block mt-4 px-6 py-2.5 rounded-lg font-bold text-sm" style={{ backgroundColor: "#c9920a", color: "#fff" }}>
                  View Course &rarr;
                </Link>
              </div>
              <div className="w-full sm:w-64 aspect-video rounded-xl bg-black/30 flex items-center justify-center text-4xl">
                &#127909;
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter bar */}
      <section className="px-4 pb-4">
        <div className="max-w-6xl mx-auto flex gap-2 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={filter === cat ? { backgroundColor: "#1a6b4a", color: "#fff" } : { backgroundColor: "#fff", color: "#666", border: "1px solid #e0dbd3" }}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Course grid */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse"><div className="aspect-video bg-gray-200 rounded-lg mb-3" /><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
            ))
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 col-span-3 text-center py-8">No courses in this category yet.</p>
          ) : (
            filtered.map(c => (
              <Link key={c.id} href={`/academy/${c.slug}`} className="card hover:shadow-lg transition-all group">
                <div className="aspect-video rounded-lg mb-3 flex items-center justify-center text-4xl" style={{ backgroundColor: "#f0ebe3" }}>
                  {c.category === "Arabic Letters" ? "&#128212;" : c.category === "Ramadan" ? "&#127769;" : c.category === "Islamic Values" ? "&#128155;" : "&#127891;"}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#f0ebe3", color: "#1a6b4a" }}>{c.category}</span>
                  {c.languages.map(l => <span key={l} className="text-xs text-gray-400">{l}</span>)}
                </div>
                <h3 className="font-bold text-gray-900 group-hover:text-green-800 transition-colors">{c.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "'Amiri', serif" }}>{c.titleAr}</p>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description.slice(0, 100)}...</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div>
                    {c.avgRating && <span className="text-sm text-yellow-500">{"★".repeat(Math.round(c.avgRating))} <span className="text-gray-400 text-xs">({c.reviewCount})</span></span>}
                    <div className="text-xs text-gray-400">{c.totalLessons} lessons &middot; {Math.round(c.totalMinutes / 60)}h</div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold" style={{ color: "#c9920a" }}>${c.price}</span>
                    {c.enrolled ? (
                      <div className="text-xs font-medium" style={{ color: "#1a6b4a" }}>&#10003; Enrolled</div>
                    ) : (
                      <div className="text-xs text-gray-400">one-time</div>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <footer className="text-center py-6 text-sm text-gray-400">Noor Academy &copy; 2026 &mdash; Part of Noor Printables</footer>
    </div>
  );
}
