"use client";

import { useState, useEffect, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

function PatternPuzzleGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const gridSize = difficulty === "easy" ? 3 : difficulty === "medium" ? 4 : 5;
  const timeLimit = difficulty === "easy" ? 0 : difficulty === "medium" ? 180 : 90;

  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(timeLimit);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Create solved state then shuffle
    const total = gridSize * gridSize;
    const solved = Array.from({ length: total }, (_, i) => i); // 0 = empty
    // Shuffle by making random valid moves
    let s = level * 100;
    const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const state = [...solved];
    let emptyIdx = 0;
    const shuffleMoves = gridSize * gridSize * 20;

    for (let i = 0; i < shuffleMoves; i++) {
      const neighbors: number[] = [];
      const r = Math.floor(emptyIdx / gridSize), c = emptyIdx % gridSize;
      if (r > 0) neighbors.push(emptyIdx - gridSize);
      if (r < gridSize - 1) neighbors.push(emptyIdx + gridSize);
      if (c > 0) neighbors.push(emptyIdx - 1);
      if (c < gridSize - 1) neighbors.push(emptyIdx + 1);
      const swap = neighbors[Math.floor(rand() * neighbors.length)];
      [state[emptyIdx], state[swap]] = [state[swap], state[emptyIdx]];
      emptyIdx = swap;
    }

    setTiles(state); setMoves(0); setTimer(timeLimit); setDone(false);
  }, [level, difficulty, gridSize, timeLimit]);

  useEffect(() => {
    if (done || timeLimit === 0) return;
    if (timer <= 0) {
      setDone(true);
      onComplete({ level, difficulty, score: 50, stars: 1, timeSeconds: timeLimit, xpEarned: XP_PER_DIFFICULTY[difficulty] });
      return;
    }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, done, timeLimit]);

  const handleTileClick = useCallback((idx: number) => {
    if (done) return;
    const emptyIdx = tiles.indexOf(0);
    const r1 = Math.floor(idx / gridSize), c1 = idx % gridSize;
    const r2 = Math.floor(emptyIdx / gridSize), c2 = emptyIdx % gridSize;

    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

    const newTiles = [...tiles];
    [newTiles[idx], newTiles[emptyIdx]] = [newTiles[emptyIdx], newTiles[idx]];
    setTiles(newTiles);
    setMoves(m => m + 1);
    sounds.correct();

    // Check solved
    const isSolved = newTiles.every((t, i) => t === i);
    if (isSolved) {
      setDone(true);
      const maxMoves = gridSize * gridSize * 10;
      const score = Math.max(50, 300 - Math.floor(moves / 2));
      const stars = calculateStars(maxMoves - moves, maxMoves);
      sounds.perfect();
      onComplete({ level, difficulty, score, stars, timeSeconds: timeLimit - timer, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
    }
  }, [tiles, gridSize, done, moves, timer, timeLimit, level, difficulty, onComplete]);

  const cellSize = Math.min(70, (typeof window !== "undefined" ? (window.innerWidth - 64) / gridSize : 70));
  const colors = ["#1a6b4a", "#0d9488", "#c9920a", "#2563eb", "#7c3aed", "#dc2626", "#e67e22", "#1abc9c", "#e91e63"];

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <div className="text-xs text-white/50 mb-3">
        Moves: {moves}
        {timeLimit > 0 && <span style={{ color: timer <= 10 ? "#dc2626" : undefined }}> &middot; ⏱ {timer}s</span>}
      </div>

      <div className="flex-1 flex items-center">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`, gap: 3 }}>
          {tiles.map((tile, idx) => (
            <button key={idx} onClick={() => handleTileClick(idx)}
              className="rounded-lg flex items-center justify-center font-bold transition-all"
              style={{
                width: cellSize, height: cellSize,
                backgroundColor: tile === 0 ? "transparent" : colors[tile % colors.length] + "40",
                border: tile === 0 ? "1px dashed rgba(255,255,255,0.1)" : `2px solid ${colors[tile % colors.length]}`,
                color: tile === 0 ? "transparent" : colors[tile % colors.length],
                fontSize: cellSize * 0.35,
              }}>
              {tile > 0 ? tile : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PatroonPuzzelPage() {
  return (
    <GameWrapper gameSlug="patroon-puzzel" gameName="Patroon Puzzel">
      {({ level, difficulty, onComplete }) => (
        <PatternPuzzleGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
