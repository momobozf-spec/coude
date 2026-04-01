"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";

interface Lesson { id: string; title: string; description: string | null; duration: number; order: number; isFree: boolean; videoUrl: string | null; progress: { watchedSeconds: number; completed: boolean } | null; }
interface CourseData { id: string; slug: string; title: string; titleAr: string; description: string; price: number; currency: string; languages: string[]; ageRange: string; category: string; totalLessons: number; totalMinutes: number; avgRating: number | null; reviewCount: number; trailerUrl: string | null; }
interface Review { rating: number; comment: string | null; userId: string; createdAt: string; }

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrollLoading, setEnrollLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/academy/courses/${slug}`).then(r => r.json()).then(d => {
      setCourse(d.course); setLessons(d.lessons || []); setReviews(d.reviews || []);
      setIsEnrolled(d.isEnrolled); setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  async function handleEnroll() {
    setEnrollLoading(true);
    try {
      const res = await fetch("/api/academy/enroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course?.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.enrolled) setIsEnrolled(true);
    } catch { /* */ }
    setEnrollLoading(false);
  }

  async function handleRedeemPro() {
    setEnrollLoading(true);
    try {
      const res = await fetch("/api/academy/redeem-pro-course", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course?.id }),
      });
      const data = await res.json();
      if (data.success) { setIsEnrolled(true); }
    } catch { /* */ }
    setEnrollLoading(false);
  }

  if (loading || !course) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;

  const completedCount = lessons.filter(l => l.progress?.completed).length;
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: "#fdf8f0" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/academy" className="text-sm text-gray-500 hover:text-gray-700">&larr; All Courses</Link>
          <Link href="/" className="text-lg font-bold" style={{ color: "#1a6b4a" }}>Noor Academy</Link>
          <div className="w-20" />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1">
            {/* Hero */}
            <div className="aspect-video rounded-xl mb-6 flex items-center justify-center text-5xl" style={{ backgroundColor: "#1a6b4a" }}>
              <span className="text-white opacity-40">&#127909;</span>
            </div>

            <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: "#f0ebe3", color: "#1a6b4a" }}>{course.category}</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3 mb-1">{course.title}</h1>
            <p className="text-lg text-gray-400 mb-4" style={{ fontFamily: "'Amiri', serif" }}>{course.titleAr}</p>
            <p className="text-gray-600 leading-relaxed mb-6">{course.description}</p>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-8">
              <span>&#127891; {course.totalLessons} lessons</span>
              <span>&#9201; {Math.floor(course.totalMinutes / 60)}h {course.totalMinutes % 60}m</span>
              <span>&#127759; {course.languages.join(", ")}</span>
              <span>&#128118; Ages {course.ageRange}</span>
              {course.avgRating && <span className="text-yellow-500">{"★".repeat(Math.round(course.avgRating))} ({course.reviewCount})</span>}
            </div>

            {/* Curriculum */}
            <h2 className="text-xl font-bold text-gray-900 mb-4">Curriculum</h2>
            <div className="space-y-2 mb-8">
              {lessons.map((l, i) => {
                const locked = !isEnrolled && !l.isFree;
                return (
                  <div key={l.id} className="card flex items-center gap-3 py-3 px-4" style={locked ? { opacity: 0.6 } : {}}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{
                      backgroundColor: l.progress?.completed ? "#1a6b4a" : "#f0ebe3",
                      color: l.progress?.completed ? "#fff" : "#666",
                    }}>
                      {l.progress?.completed ? "✓" : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                      <p className="text-xs text-gray-400">{Math.floor(l.duration / 60)} min</p>
                    </div>
                    {l.isFree && !isEnrolled && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#e8f5ec", color: "#1a6b4a" }}>FREE</span>}
                    {locked && <span className="text-gray-400">&#128274;</span>}
                    {(isEnrolled || l.isFree) && (
                      <Link href={`/academy/learn/${course.slug}?lesson=${i}`} className="text-xs font-medium hover:underline" style={{ color: "#1a6b4a" }}>
                        {l.progress?.completed ? "Rewatch" : "Play"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Reviews</h2>
                <div className="space-y-3 mb-8">
                  {reviews.slice(0, 5).map((r, i) => (
                    <div key={i} className="card py-3 px-4">
                      <span className="text-yellow-500 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-80">
            <div className="card sticky top-20">
              <div className="text-center mb-4">
                <div className="text-3xl font-extrabold" style={{ color: "#c9920a" }}>${course.price}</div>
                <p className="text-xs text-gray-400">one-time payment &middot; lifetime access</p>
              </div>

              {isEnrolled ? (
                <>
                  <Link href={`/academy/learn/${course.slug}`} className="btn-primary w-full text-center py-3 mb-2" style={{ backgroundColor: "#1a6b4a", display: "block" }}>
                    {completedCount > 0 ? "Continue Learning" : "Start Learning"} &rarr;
                  </Link>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{completedCount}/{lessons.length} lessons</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: "#1a6b4a" }} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {session ? (
                    <button onClick={handleEnroll} disabled={enrollLoading} className="btn-primary w-full py-3 mb-2" style={{ backgroundColor: "#1a6b4a" }}>
                      {enrollLoading ? "..." : `Enroll Now — $${course.price}`}
                    </button>
                  ) : (
                    <Link href="/register" className="btn-primary w-full text-center py-3 mb-2" style={{ backgroundColor: "#1a6b4a", display: "block" }}>
                      Sign Up to Enroll
                    </Link>
                  )}
                  {session && (
                    <button onClick={handleRedeemPro} disabled={enrollLoading} className="btn-outline w-full py-2.5 text-sm mb-3">
                      Pro user? Redeem free course
                    </button>
                  )}
                </>
              )}

              <div className="text-xs text-gray-500 space-y-1.5 mt-4 pt-4 border-t border-gray-100">
                <p>&#10003; {course.totalLessons} video lessons</p>
                <p>&#10003; {Math.floor(course.totalMinutes / 60)}+ hours of content</p>
                <p>&#10003; Certificate on completion</p>
                <p>&#10003; 30-day money-back guarantee</p>
                <p>&#10003; Lifetime access</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
