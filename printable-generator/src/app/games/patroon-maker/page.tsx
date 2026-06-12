"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

const COLORS = ["#1a6b4a", "#c9920a", "#2563eb", "#dc2626", "#7c3aed", "#e67e22", "#1abc9c", "#e91e63", "#8bc34a", "#00bcd4", "#795548", "#f1c40f"];

function PatternMakerGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridSize = difficulty === "easy" ? 6 : difficulty === "medium" ? 8 : 10;
  const colorCount = difficulty === "easy" ? 4 : difficulty === "medium" ? 8 : 12;
  const [grid, setGrid] = useState<number[][]>([]);
  const [activeColor, setActiveColor] = useState(0);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    setGrid(Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => -1)));
    setActiveColor(0); setMoves(0);
  }, [level, difficulty, gridSize]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid.length) return;
    const size = 300;
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    const cellSize = size / gridSize;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, size, size);

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const color = grid[r][c] >= 0 ? COLORS[grid[r][c]] : "rgba(255,255,255,0.04)";
        ctx.fillStyle = color;
        ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);

        // Auto-symmetry: mirror to other quadrants
        if (grid[r][c] >= 0) {
          const mr = gridSize - 1 - r, mc = gridSize - 1 - c;
          ctx.fillRect(mc * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2); // horizontal
          ctx.fillRect(c * cellSize + 1, mr * cellSize + 1, cellSize - 2, cellSize - 2); // vertical
          ctx.fillRect(mc * cellSize + 1, mr * cellSize + 1, cellSize - 2, cellSize - 2); // diagonal
        }

        ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 0.5;
        ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }, [grid, gridSize]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = 300;
    const x = (e.clientX - rect.left) / rect.width * size;
    const y = (e.clientY - rect.top) / rect.height * size;
    const cellSize = size / gridSize;
    const c = Math.floor(x / cellSize), r = Math.floor(y / cellSize);
    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return;

    setGrid(prev => {
      const ng = prev.map(row => [...row]);
      ng[r][c] = ng[r][c] === activeColor ? -1 : activeColor;
      return ng;
    });
    setMoves(m => m + 1);
    sounds.correct();
  }, [activeColor, gridSize]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `noor-pattern-${level}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [level]);

  const handleComplete = () => {
    const filledCells = grid.flat().filter(c => c >= 0).length;
    const score = filledCells * 5 + moves;
    onComplete({ level, difficulty, score, stars: filledCells > gridSize ? 3 : filledCells > gridSize / 2 ? 2 : 1, timeSeconds: 0, xpEarned: XP_PER_DIFFICULTY[difficulty] });
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <p className="text-xs text-white/40 mb-3">Create a pattern — auto-mirrors to all 4 quadrants</p>

      <canvas ref={canvasRef} onClick={handleClick} className="rounded-xl mb-4 cursor-crosshair" />

      <div className="flex flex-wrap gap-1.5 justify-center max-w-xs mb-4">
        {COLORS.slice(0, colorCount).map((color, i) => (
          <button key={i} onClick={() => setActiveColor(i)} className="w-7 h-7 rounded-full transition-all"
            style={{ backgroundColor: color, border: activeColor === i ? "3px solid white" : "2px solid transparent", transform: activeColor === i ? "scale(1.2)" : "scale(1)" }} />
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => { setGrid(Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => -1))); setMoves(0); }}
          className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/50">Clear</button>
        <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/50">💾 Save PNG</button>
        <button onClick={handleComplete} className="text-xs px-3 py-1.5 rounded font-bold text-white" style={{ backgroundColor: "#1a6b4a" }}>✓ Complete</button>
      </div>
    </div>
  );
}

export default function PatroonMakerPage() {
  return (
    <GameWrapper gameSlug="patroon-maker" gameName="Patroon Maker">
      {({ level, difficulty, onComplete }) => (
        <PatternMakerGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
