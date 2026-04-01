"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import VideoPlayer from "@/components/academy/VideoPlayer";

interface Lesson { id: string; title: string; description: string | null; videoUrl: string | null; duration: number; order: number; isFree: boolean; transcript: string | null; progress: { watchedSeconds: number; completed: boolean } | null; }
interface CourseData { id: string; slug: string; title: string; totalLessons: number; }

export default function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/academy/courses/${slug}`);
    const d = await res.json();
    setCourse(d.course); setLessons(d.lessons || []); setIsEnrolled(d.isEnrolled); setLoading(false);
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    // Set initial lesson from URL param
    const params = new URLSearchParams(window.location.search);
    const lessonParam = params.get("lesson");
    if (lessonParam) setCurrentIdx(parseInt(lessonParam));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">Loading...</div>;
  if (!session) { router.push("/login"); return null; }
  if (!course || lessons.length === 0) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Course not found</div>;

  const lesson = lessons[currentIdx];
  const canWatch = isEnrolled || lesson?.isFree;
  const completedCount = lessons.filter(l => l.progress?.completed).length;
  const progressPct = Math.round((completedCount / lessons.length) * 100);

  if (!canWatch) { router.push(`/academy/${slug}`); return null; }

  function goToLesson(idx: number) {
    if (idx >= 0 && idx < lessons.length) {
      const target = lessons[idx];
      if (isEnrolled || target.isFree) {
        setCurrentIdx(idx);
        window.scrollTo(0, 0);
      }
    }
  }

  function handleComplete() {
    // Refresh to update progress checkmarks
    setLessons(prev => prev.map((l, i) => i === currentIdx ? { ...l, progress: { watchedSeconds: l.duration, completed: true } } : l));
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: "#111" }}>
      {/* Sidebar — lesson list */}
      <aside className="lg:w-80 bg-gray-900 border-r border-gray-800 lg:h-screen lg:overflow-y-auto order-2 lg:order-1">
        <div className="p-4 border-b border-gray-800">
          <Link href={`/academy/${slug}`} className="text-xs text-gray-500 hover:text-gray-300">&larr; Course page</Link>
          <h2 className="text-sm font-bold text-white mt-2 truncate">{course.title}</h2>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Lesson {currentIdx + 1} of {lessons.length}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full">
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: "#1a6b4a" }} />
            </div>
          </div>
        </div>

        <div className="p-2">
          {lessons.map((l, i) => {
            const locked = !isEnrolled && !l.isFree;
            const isCurrent = i === currentIdx;
            return (
              <button
                key={l.id}
                onClick={() => !locked && goToLesson(i)}
                disabled={locked}
                className="w-full text-left p-3 rounded-lg mb-1 flex items-center gap-3 transition-all"
                style={{
                  backgroundColor: isCurrent ? "rgba(26,107,74,0.2)" : "transparent",
                  borderLeft: isCurrent ? "3px solid #1a6b4a" : "3px solid transparent",
                  opacity: locked ? 0.4 : 1,
                }}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{
                  backgroundColor: l.progress?.completed ? "#1a6b4a" : "rgba(255,255,255,0.1)",
                  color: l.progress?.completed ? "#fff" : "#888",
                }}>
                  {l.progress?.completed ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{l.title}</p>
                  <p className="text-xs text-gray-500">{Math.floor(l.duration / 60)} min{locked ? " 🔒" : ""}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main — video + lesson info */}
      <main className="flex-1 order-1 lg:order-2 lg:h-screen lg:overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4">
          {/* Video */}
          {lesson?.videoUrl && (
            <VideoPlayer
              videoUrl={lesson.videoUrl}
              lessonId={lesson.id}
              initialProgress={lesson.progress?.watchedSeconds || 0}
              duration={lesson.duration}
              onComplete={handleComplete}
              nextLessonTitle={currentIdx < lessons.length - 1 ? lessons[currentIdx + 1]?.title : undefined}
              onNextLesson={currentIdx < lessons.length - 1 ? () => goToLesson(currentIdx + 1) : undefined}
            />
          )}

          {/* Lesson info */}
          <div className="mt-6">
            <h1 className="text-xl font-bold text-white mb-1">{lesson?.title}</h1>
            {lesson?.description && <p className="text-sm text-gray-400 mb-4">{lesson.description}</p>}

            <div className="flex gap-3 mb-6">
              {!lesson?.progress?.completed && (
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: "#1a6b4a" }}
                >
                  &#10003; Mark as Complete
                </button>
              )}
              {lesson?.transcript && (
                <button onClick={() => setShowTranscript(!showTranscript)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700">
                  {showTranscript ? "Hide" : "Show"} Transcript
                </button>
              )}
            </div>

            {showTranscript && lesson?.transcript && (
              <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 leading-relaxed mb-6">
                {lesson.transcript}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-gray-800">
              <button onClick={() => goToLesson(currentIdx - 1)} disabled={currentIdx === 0} className="text-sm text-gray-500 hover:text-white disabled:opacity-30">
                &larr; Previous
              </button>
              <button onClick={() => goToLesson(currentIdx + 1)} disabled={currentIdx >= lessons.length - 1} className="text-sm font-medium hover:text-white disabled:opacity-30" style={{ color: "#1a6b4a" }}>
                Next Lesson &rarr;
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
