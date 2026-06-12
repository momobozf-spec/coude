"use client";

import { useState, useEffect, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

const THEMES: Record<string, string[]> = {
  ramadan: ["RAMADAN", "FAST", "IFTAR", "QURAN", "PRAYER", "MOSQUE", "DATES", "SUHOOR", "DUA", "CHARITY", "TARAWEEH", "CRESCENT"],
  prophets: ["IBRAHIM", "MUSA", "ISA", "NUH", "ADAM", "YUSUF", "DAWUD", "SULAIMAN", "AYUB", "YUNUS", "IDRIS", "SALIH"],
  prayer: ["SALAH", "WUDU", "QURAN", "SUJUD", "RUKU", "IMAM", "FAJR", "DHUHR", "ASR", "ISHA", "ADHAN", "IQAMA"],
  hajj: ["HAJJ", "KAABA", "TAWAF", "IHRAM", "MINA", "ARAFAT", "JAMARAT", "SAFA", "MARWA", "ZAMZAM", "MUZDALIFA", "PILGRIM"],
  months: ["MUHARRAM", "SAFAR", "RAJAB", "SHABAN", "RAMADAN", "SHAWWAL", "DHUL", "HIJJAH", "JUMADA", "RABI", "ISLAMIC", "LUNAR"],
};
const THEME_ORDER = ["ramadan", "prophets", "prayer", "hajj", "months"];

function createGrid(size: number, words: string[]): { grid: string[][]; placed: string[] } {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const dirs = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0]];
  const placed: string[] = [];
  let seed = 42;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  for (const word of words) {
    let ok = false;
    for (let attempt = 0; attempt < 200 && !ok; attempt++) {
      const d = dirs[Math.floor(rand() * dirs.length)];
      const r = Math.floor(rand() * size);
      const c = Math.floor(rand() * size);
      let canPlace = true;
      for (let i = 0; i < word.length && canPlace; i++) {
        const nr = r + i * d[0], nc = c + i * d[1];
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) canPlace = false;
        else if (grid[nr][nc] && grid[nr][nc] !== word[i]) canPlace = false;
      }
      if (canPlace) {
        for (let i = 0; i < word.length; i++) grid[r + i * d[0]][c + i * d[1]] = word[i];
        placed.push(word);
        ok = true;
      }
    }
  }
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = letters[Math.floor(rand() * 26)];
  return { grid, placed };
}

function WordSearchGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const gridSize = difficulty === "easy" ? 8 : difficulty === "medium" ? 12 : 16;
  const wordCount = difficulty === "easy" ? 5 : difficulty === "medium" ? 8 : 12;
  const timeLimit = difficulty === "easy" ? 120 : difficulty === "medium" ? 90 : 60;
  const themeIdx = Math.floor((level - 1) / 3) % THEME_ORDER.length;
  const themeWords = THEMES[THEME_ORDER[themeIdx]].slice(0, wordCount);

  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState<[number, number][]>([]);
  const [timer, setTimer] = useState(timeLimit);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { grid: g, placed } = createGrid(gridSize, themeWords);
    setGrid(g); setWords(placed); setFound(new Set()); setTimer(timeLimit); setScore(0); setDone(false); setSelecting([]);
  }, [level, difficulty, gridSize, timeLimit]);

  useEffect(() => {
    if (done || timer <= 0) return;
    const t = setTimeout(() => {
      if (timer <= 1 && !done) {
        setDone(true);
        const stars = calculateStars(found.size, words.length);
        onComplete({ level, difficulty, score, stars, timeSeconds: timeLimit - timer, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
      }
      setTimer(s => s - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [timer, done]);

  const handleCellClick = useCallback((r: number, c: number) => {
    if (done) return;
    setSelecting(prev => {
      const newSel = [...prev, [r, c] as [number, number]];
      // Check if selection forms a word
      const selected = newSel.map(([rr, cc]) => grid[rr]?.[cc] || "").join("");
      if (words.includes(selected) && !found.has(selected)) {
        setFound(prev2 => {
          const n = new Set(prev2);
          n.add(selected);
          const newScore = score + selected.length * 10 + Math.max(0, timer);
          setScore(newScore);
          sounds.match();

          if (n.size >= words.length) {
            setDone(true);
            const stars = calculateStars(newScore, words.length * 50);
            sounds.perfect();
            onComplete({ level, difficulty, score: newScore, stars, timeSeconds: timeLimit - timer, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
          }
          return n;
        });
        return [];
      }
      if (newSel.length > 16) return []; // reset if too long
      return newSel;
    });
  }, [grid, words, found, done, score, timer, level, difficulty, onComplete, timeLimit]);

  const cellSize = Math.min(36, (typeof window !== "undefined" ? window.innerWidth - 32 : 400) / gridSize);

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      {/* HUD */}
      <div className="w-full max-w-lg flex justify-between text-sm text-white/60 mb-2">
        <span>Found: {found.size}/{words.length}</span>
        <span>Score: {score}</span>
        <span style={{ color: timer <= 10 ? "#dc2626" : undefined }}>⏱ {timer}s</span>
      </div>

      {/* Grid */}
      <div className="mb-4" style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`, gap: 1 }}>
        {grid.map((row, r) => row.map((cell, c) => {
          const isSelecting = selecting.some(([sr, sc]) => sr === r && sc === c);
          return (
            <button key={`${r}-${c}`} onClick={() => handleCellClick(r, c)}
              className="flex items-center justify-center font-mono font-bold transition-all"
              style={{
                width: cellSize, height: cellSize, fontSize: cellSize * 0.45,
                backgroundColor: isSelecting ? "rgba(201,146,10,0.3)" : "rgba(255,255,255,0.06)",
                color: isSelecting ? "#c9920a" : "rgba(255,255,255,0.7)",
                borderRadius: 3,
              }}>
              {cell}
            </button>
          );
        }))}
      </div>

      {/* Word list */}
      <div className="flex flex-wrap gap-2 justify-center">
        {words.map(w => (
          <span key={w} className="text-xs font-mono px-2 py-1 rounded" style={{
            backgroundColor: found.has(w) ? "rgba(26,107,74,0.3)" : "rgba(255,255,255,0.06)",
            color: found.has(w) ? "#1a6b4a" : "rgba(255,255,255,0.4)",
            textDecoration: found.has(w) ? "line-through" : "none",
          }}>{w}</span>
        ))}
      </div>

      <button onClick={() => setSelecting([])} className="mt-3 text-xs text-white/30 hover:text-white/50">Clear Selection</button>
    </div>
  );
}

export default function WordenZoekerPage() {
  return (
    <GameWrapper gameSlug="woorden-zoeker-race" gameName="Woorden Zoeker Race">
      {({ level, difficulty, onComplete }) => (
        <WordSearchGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
