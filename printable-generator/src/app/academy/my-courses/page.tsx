"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface EnrolledCourse {
  id: string; slug: string; title: string; titleAr: string; category: string;
  totalLessons: number; completedLessons: number; completedAt: string | null;
  enrollmentId: string;
}

export default function MyCoursesPage() {
  const { data: session } = useSession();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    // Fetch all courses and filter enrolled
    fetch("/api/academy/courses").then(r => r.json()).then(async (d) => {
      const enrolled = (d.courses || []).filter((c: { enrolled: boolean }) => c.enrolled);
      // Get details for each enrolled course
      const detailed = await Promise.all(enrolled.map(async (c: { slug: string }) => {
        const res = await fetch(`/api/academy/courses/${c.slug}`);
        const detail = await res.json();
        const completedLessons = (detail.lessons || []).filter((l: { progress: { completed: boolean } | null }) => l.progress?.completed).length;
        return {
          id: detail.course.id,
          slug: detail.course.slug,
          title: detail.course.title,
          titleAr: detail.course.titleAr,
          category: detail.course.category,
          totalLessons: detail.course.totalLessons,
          completedLessons,
          completedAt: detail.completedAt,
          enrollmentId: "enrollment",
        };
      }));
      setCourses(detailed);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session]);

  if (!session) return <div className="min-h-screen flex items-center justify-center"><Link href="/login" className="btn-primary">Log in</Link></div>;

  return (
    <div className="min-h-screen" style={{ background: "#fdf8f0" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/academy" className="text-lg font-bold" style={{ color: "#1a6b4a" }}>Noor Academy</Link>
          <Link href="/academy" className="text-sm text-gray-500 hover:text-gray-700">Browse Courses</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-6">My Courses</h1>

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : courses.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-3xl mb-3">&#127891;</p>
            <p className="text-gray-500 mb-4">You haven&apos;t enrolled in any courses yet.</p>
            <Link href="/academy" className="btn-primary" style={{ backgroundColor: "#1a6b4a" }}>Browse Courses</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {courses.map(c => {
              const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
              const isComplete = !!c.completedAt;
              return (
                <div key={c.id} className="card">
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#f0ebe3", color: "#1a6b4a" }}>{c.category}</span>
                  <h3 className="font-bold text-gray-900 mt-2">{c.title}</h3>
                  <p className="text-xs text-gray-400" style={{ fontFamily: "'Amiri', serif" }}>{c.titleAr}</p>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{c.completedLessons}/{c.totalLessons} lessons</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isComplete ? "#c9920a" : "#1a6b4a" }} />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link href={`/academy/learn/${c.slug}`} className="btn-primary text-sm flex-1 text-center" style={{ backgroundColor: "#1a6b4a" }}>
                      {isComplete ? "Rewatch" : c.completedLessons > 0 ? "Continue" : "Start"}
                    </Link>
                    {isComplete && (
                      <Link href={`/academy/certificate/${c.id}`} className="btn-outline text-sm px-3" title="Certificate">
                        &#127942;
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
