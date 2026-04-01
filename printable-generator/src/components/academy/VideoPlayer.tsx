"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  videoUrl: string;
  lessonId: string;
  initialProgress?: number;
  duration: number;
  onComplete?: () => void;
  nextLessonTitle?: string;
  onNextLesson?: () => void;
}

export default function VideoPlayer({
  videoUrl,
  lessonId,
  initialProgress = 0,
  duration,
  onComplete,
  nextLessonTitle,
  onNextLesson,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(initialProgress);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(3);
  const [completed, setCompleted] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save progress every 10 seconds
  const saveProgress = useCallback(async (seconds: number, isComplete: boolean) => {
    try {
      await fetch("/api/academy/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, watchedSeconds: Math.floor(seconds), completed: isComplete }),
      });
    } catch { /* silent */ }
  }, [lessonId]);

  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (videoRef.current && playing) {
        saveProgress(videoRef.current.currentTime, false);
      }
    }, 10000);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
  }, [playing, saveProgress]);

  // Set initial time
  useEffect(() => {
    if (videoRef.current && initialProgress > 0) {
      videoRef.current.currentTime = initialProgress;
    }
  }, [initialProgress]);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    setTotalDuration(v.duration || duration);

    // Mark complete at 90%
    if (!completed && v.currentTime / (v.duration || duration) >= 0.9) {
      setCompleted(true);
      saveProgress(v.currentTime, true);
      onComplete?.();
    }

    // Show next lesson overlay in last 15 seconds
    if (nextLessonTitle && v.duration - v.currentTime <= 15 && v.duration - v.currentTime > 0) {
      setShowNextOverlay(true);
    }
  }

  function handleEnded() {
    if (!completed) {
      setCompleted(true);
      saveProgress(totalDuration, true);
      onComplete?.();
    }
    // Auto-advance countdown
    if (onNextLesson) {
      setShowNextOverlay(true);
      let count = 3;
      setNextCountdown(count);
      const timer = setInterval(() => {
        count--;
        setNextCountdown(count);
        if (count <= 0) { clearInterval(timer); onNextLesson(); }
      }, 1000);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  function seek(offset: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + offset));
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * (v.duration || duration);
  }

  function toggleFullscreen() {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": seek(10); break;
        case "ArrowLeft": seek(-10); break;
        case "f": toggleFullscreen(); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isPlaceholder = videoUrl.includes("placeholder");

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
      {isPlaceholder ? (
        // Placeholder for demo
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <div className="text-5xl mb-4">&#127909;</div>
          <p className="text-lg font-medium">Video Player</p>
          <p className="text-sm text-gray-400 mt-1">Replace videoUrl with your Bunny.net stream URL</p>
          <button onClick={() => { setPlaying(!playing); }} className="mt-4 px-6 py-2 rounded-lg bg-white/20 text-sm hover:bg-white/30">
            {playing ? "Pause Demo" : "Play Demo"}
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline
        />
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2" onClick={seekTo}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "#1a6b4a" }} />
        </div>

        <div className="flex items-center gap-3 text-white text-sm">
          <button onClick={togglePlay} className="hover:text-green-400">
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={() => seek(-10)} className="hover:text-green-400 text-xs">-10s</button>
          <button onClick={() => seek(10)} className="hover:text-green-400 text-xs">+10s</button>
          <span className="text-xs text-gray-300">{fmt(currentTime)} / {fmt(totalDuration)}</span>
          <div className="flex-1" />
          {completed && <span className="text-xs text-green-400">&#10003; Completed</span>}
          <button onClick={toggleFullscreen} className="hover:text-green-400">&#9974;</button>
        </div>
      </div>

      {/* Next lesson overlay */}
      {showNextOverlay && nextLessonTitle && (
        <div className="absolute top-4 right-4 bg-black/80 text-white rounded-lg p-3 max-w-[200px]">
          <p className="text-xs text-gray-400">Up next</p>
          <p className="text-sm font-medium truncate">{nextLessonTitle}</p>
          {onNextLesson && (
            <button onClick={onNextLesson} className="mt-2 text-xs bg-white/20 px-3 py-1 rounded hover:bg-white/30">
              Play now ({nextCountdown}s)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
