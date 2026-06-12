"use client";

import { useState, useEffect, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

const ARABIC_NUMS = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function generateSudoku(given: number, seed: number): { puzzle: number[][]; solution: number[][] } {
  // Simple valid Sudoku generator via rotation
  const base = [[1,2,3,4,5,6,7,8,9],[4,5,6,7,8,9,1,2,3],[7,8,9,1,2,3,4,5,6],[2,3,1,5,6,4,8,9,7],[5,6,4,8,9,7,2,3,1],[8,9,7,2,3,1,5,6,4],[3,1,2,6,4,5,9,7,8],[6,4,5,9,7,8,3,1,2],[9,7,8,3,1,2,6,4,5]];
  // Shuffle rows within bands and cols within stacks
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  const solution = base.map(r => [...r]);
  // Swap some rows within bands
  for (let band = 0; band < 3; band++) {
    for (let i = 0; i < 3; i++) {
      const j = Math.floor(rand() * 3);
      const r1 = band * 3 + i, r2 = band * 3 + j;
      [solution[r1], solution[r2]] = [solution[r2], solution[r1]];
    }
  }

  const puzzle = solution.map(r => [...r]);
  // Remove cells
  const total = 81;
  let removed = 0;
  const target = total - given;
  while (removed < target) {
    const r = Math.floor(rand() * 9), c = Math.floor(rand() * 9);
    if (puzzle[r][c] !== 0) { puzzle[r][c] = 0; removed++; }
  }

  return { puzzle, solution };
}

function SudokuGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const givenCount = difficulty === "easy" ? 45 : difficulty === "medium" ? 35 : 25;
  const hintsAllowed = difficulty === "easy" ? 3 : difficulty === "medium" ? 1 : 0;
  const [useArabic, setUseArabic] = useState(true);

  const [grid, setGrid] = useState<number[][]>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [original, setOriginal] = useState<boolean[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [hints, setHints] = useState(hintsAllowed);
  const [errors, setErrors] = useState(0);
  const [timer, setTimer] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { puzzle, solution: sol } = generateSudoku(givenCount, level * 100 + givenCount);
    setGrid(puzzle.map(r => [...r]));
    setSolution(sol);
    setOriginal(puzzle.map(r => r.map(c => c !== 0)));
    setSelected(null); setHints(hintsAllowed); setErrors(0); setTimer(0); setDone(false);
  }, [level, difficulty, givenCount, hintsAllowed]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTimer(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  const placeNumber = useCallback((num: number) => {
    if (!selected || done) return;
    const [r, c] = selected;
    if (original[r][c]) return;

    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = num;
    setGrid(newGrid);

    if (num !== solution[r][c]) {
      setErrors(e => e + 1);
      sounds.wrong();
      return;
    }

    sounds.correct();

    // Check complete
    const allFilled = newGrid.every((row, ri) => row.every((cell, ci) => cell === solution[ri][ci]));
    if (allFilled) {
      setDone(true);
      const maxScore = 500;
      const score = Math.max(50, maxScore - errors * 30 - Math.floor(timer / 10));
      const stars = calculateStars(score, maxScore);
      sounds.perfect();
      onComplete({ level, difficulty, score, stars, timeSeconds: timer, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
    }
  }, [selected, grid, solution, original, done, errors, timer, level, difficulty, onComplete]);

  const useHint = useCallback(() => {
    if (hints <= 0 || !selected || done) return;
    const [r, c] = selected;
    if (original[r][c] || grid[r][c] === solution[r][c]) return;
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = solution[r][c];
    setGrid(newGrid);
    setHints(h => h - 1);
    sounds.match();
  }, [hints, selected, grid, solution, original, done]);

  const fmt = (n: number) => useArabic ? ARABIC_NUMS[n - 1] : String(n);
  const cellSize = Math.min(38, (typeof window !== "undefined" ? (window.innerWidth - 48) / 9 : 38));

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <div className="w-full max-w-sm flex justify-between text-xs text-white/60 mb-3">
        <span>Errors: {errors}</span>
        <span>⏱ {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</span>
        <button onClick={() => setUseArabic(!useArabic)} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          {useArabic ? "١٢٣" : "123"}
        </button>
      </div>

      {/* Grid */}
      <div className="mb-4" style={{ display: "grid", gridTemplateColumns: `repeat(9, ${cellSize}px)`, gap: 0 }}>
        {grid.map((row, r) => row.map((cell, c) => {
          const isOriginal = original[r]?.[c];
          const isSelected = selected?.[0] === r && selected?.[1] === c;
          const isWrong = cell !== 0 && cell !== solution[r][c];
          const borderR = c % 3 === 2 && c < 8 ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)";
          const borderB = r % 3 === 2 && r < 8 ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)";

          return (
            <button key={`${r}-${c}`} onClick={() => setSelected([r, c])}
              style={{
                width: cellSize, height: cellSize,
                backgroundColor: isSelected ? "rgba(201,146,10,0.2)" : isWrong ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.04)",
                borderRight: borderR, borderBottom: borderB,
                borderTop: r === 0 ? "2px solid rgba(255,255,255,0.3)" : undefined,
                borderLeft: c === 0 ? "2px solid rgba(255,255,255,0.3)" : undefined,
                color: isOriginal ? "rgba(255,255,255,0.8)" : isWrong ? "#dc2626" : "#c9920a",
                fontWeight: isOriginal ? 400 : 700,
                fontSize: useArabic ? cellSize * 0.5 : cellSize * 0.4,
                fontFamily: useArabic ? "'Amiri', serif" : "monospace",
              }}
              className="flex items-center justify-center">
              {cell > 0 ? fmt(cell) : ""}
            </button>
          );
        }))}
      </div>

      {/* Number pad */}
      <div className="flex gap-1.5 mb-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} onClick={() => placeNumber(n)}
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white transition-all"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", fontSize: useArabic ? 18 : 14, fontFamily: useArabic ? "'Amiri', serif" : "monospace" }}>
            {fmt(n)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => { if (selected) { const g = grid.map(r => [...r]); g[selected[0]][selected[1]] = 0; setGrid(g); } }}
          className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/50">Clear</button>
        {hints > 0 && <button onClick={useHint} className="text-xs px-3 py-1.5 rounded text-white/50" style={{ backgroundColor: "rgba(201,146,10,0.2)" }}>💡 Hint ({hints})</button>}
      </div>
    </div>
  );
}

export default function SudokuPage() {
  return (
    <GameWrapper gameSlug="sudoku-islami" gameName="Sudoku Islami">
      {({ level, difficulty, onComplete }) => (
        <SudokuGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
