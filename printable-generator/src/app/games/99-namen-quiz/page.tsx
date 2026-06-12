"use client";

import { useState, useEffect, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { NAMES_99 } from "@/lib/games/names-quiz-data";
import { sounds } from "@/lib/games/game-sounds";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

interface QuizQuestion {
  name: typeof NAMES_99[0];
  options: string[];
  correctIdx: number;
}

function generateQuestions(count: number, optionCount: number): QuizQuestion[] {
  const pool = shuffle(NAMES_99);
  return pool.slice(0, Math.min(count, pool.length)).map(name => {
    const wrong = shuffle(NAMES_99.filter(n => n.transliteration !== name.transliteration))
      .slice(0, optionCount - 1)
      .map(n => n.meaningEn);
    const options = shuffle([...wrong, name.meaningEn]);
    return { name, options, correctIdx: options.indexOf(name.meaningEn) };
  });
}

function QuizGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const qCount = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 15;
  const optCount = difficulty === "hard" ? 6 : 4;
  const timeLimit = difficulty === "easy" ? 0 : difficulty === "medium" ? 20 : 10;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timer, setTimer] = useState(timeLimit);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setQuestions(generateQuestions(qCount, optCount));
    setCurrent(0); setScore(0); setStreak(0); setAnswered(null); setTimer(timeLimit); setStarted(false);
  }, [level, difficulty, qCount, optCount, timeLimit]);

  // Timer
  useEffect(() => {
    if (!started || timeLimit === 0 || answered !== null) return;
    if (timer <= 0) { handleAnswer(-1); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, started, answered, timeLimit]);

  const handleAnswer = useCallback((idx: number) => {
    if (answered !== null || !questions[current]) return;
    setAnswered(idx);

    const correct = idx === questions[current].correctIdx;
    if (correct) {
      const pts = 10 + streak * 5;
      setScore(s => s + pts);
      setStreak(s => s + 1);
      sounds.correct();
    } else {
      setStreak(0);
      sounds.wrong();
    }

    setTimeout(() => {
      if (current + 1 >= questions.length) {
        // Game complete
        const finalScore = score + (correct ? 10 + streak * 5 : 0);
        const maxScore = qCount * 30;
        const stars = calculateStars(finalScore, maxScore);
        sounds.perfect();
        onComplete({ level, difficulty, score: finalScore, stars, timeSeconds: 0, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
      } else {
        setCurrent(c => c + 1);
        setAnswered(null);
        setTimer(timeLimit);
      }
    }, 1200);
  }, [answered, current, questions, score, streak, level, difficulty, onComplete, qCount, timeLimit]);

  if (!questions.length) return null;

  if (!started) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">📖</div>
          <h2 className="text-xl font-bold text-white mb-2">99 Namen Quiz</h2>
          <p className="text-white/50 text-sm mb-4">Level {level} &middot; {qCount} vragen &middot; {optCount} opties</p>
          <button onClick={() => setStarted(true)} className="px-8 py-3 rounded-xl font-bold text-white" style={{ backgroundColor: "#1a6b4a" }}>Start</button>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Question {current + 1}/{questions.length}</span>
          <span>Score: {score}{streak > 1 && <span style={{ color: "#c9920a" }}> 🔥{streak}x</span>}</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%`, backgroundColor: "#1a6b4a" }} />
        </div>
      </div>

      {/* Timer */}
      {timeLimit > 0 && (
        <div className="mb-4 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(timer / timeLimit) * 100}%`, backgroundColor: timer <= 3 ? "#dc2626" : "#c9920a" }} />
        </div>
      )}

      {/* Question */}
      <div className="text-center mb-6">
        <p className="text-4xl mb-2" style={{ fontFamily: "'Amiri', serif" }}>{q.name.arabic}</p>
        <p className="text-lg font-bold text-white">{q.name.transliteration}</p>
        <p className="text-sm text-white/40 mt-1">What does this name mean?</p>
      </div>

      {/* Options */}
      <div className="space-y-2 flex-1">
        {q.options.map((opt, i) => {
          let bg = "rgba(255,255,255,0.06)";
          let border = "rgba(255,255,255,0.08)";
          if (answered !== null) {
            if (i === q.correctIdx) { bg = "rgba(26,107,74,0.3)"; border = "rgba(26,107,74,0.6)"; }
            else if (i === answered && i !== q.correctIdx) { bg = "rgba(220,38,38,0.3)"; border = "rgba(220,38,38,0.6)"; }
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} disabled={answered !== null}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-white transition-all"
              style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Answer feedback */}
      {answered !== null && (
        <div className="mt-4 text-center">
          <p className="text-xs text-white/40">{q.name.transliteration} = {q.name.meaningEn}</p>
          <p className="text-xs text-white/30">{q.name.meaningNl}</p>
        </div>
      )}
    </div>
  );
}

export default function NamesQuizPage() {
  return (
    <GameWrapper gameSlug="99-namen-quiz" gameName="99 Namen Quiz">
      {({ level, difficulty, onComplete }) => (
        <QuizGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
