"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

const PALETTE = ["#e74c3c", "#2ecc71", "#3498db", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#e91e63", "#00bcd4", "#8bc34a", "#ff9800", "#795548", "#607d8b", "#c9920a", "#1a6b4a", "#0f172a"];

interface Region { id: number; colorIdx: number; paths: { x: number; y: number; w: number; h: number }[]; filled: boolean; }

function generateRegions(difficulty: Difficulty, level: number): Region[] {
  const count = difficulty === "easy" ? 8 : difficulty === "medium" ? 16 : 25;
  const cols = difficulty === "easy" ? 4 : difficulty === "medium" ? 5 : 6;
  const colorCount = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 16;
  const size = 300;
  const cellW = size / cols;
  const rows = Math.ceil(count / cols);
  const cellH = size / rows;

  const regions: Region[] = [];
  let seed = level * 100;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    regions.push({
      id: i,
      colorIdx: Math.floor(rand() * colorCount),
      paths: [{ x: c * cellW + 2, y: r * cellH + 2, w: cellW - 4, h: cellH - 4 }],
      filled: false,
    });
  }
  return regions;
}

function ColorByNumberGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeColor, setActiveColor] = useState(0);
  const [filled, setFilled] = useState(0);
  const [errors, setErrors] = useState(0);
  const [done, setDone] = useState(false);
  const colorCount = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 16;

  useEffect(() => {
    setRegions(generateRegions(difficulty, level));
    setActiveColor(0); setFilled(0); setErrors(0); setDone(false);
  }, [level, difficulty]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !regions.length) return;
    canvas.width = 600; canvas.height = 600;
    canvas.style.width = "300px"; canvas.style.height = "300px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, 300, 300);

    for (const region of regions) {
      for (const p of region.paths) {
        ctx.fillStyle = region.filled ? PALETTE[region.colorIdx] : "#2a3444";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, p.w, p.h);

        if (!region.filled) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(region.colorIdx + 1), p.x + p.w / 2, p.y + p.h / 2);
        }
      }
    }
  }, [regions]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (done) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 2;
    const y = (e.clientY - rect.top) * 2;

    for (const region of regions) {
      if (region.filled) continue;
      for (const p of region.paths) {
        if (x >= p.x * 2 && x <= (p.x + p.w) * 2 && y >= p.y * 2 && y <= (p.y + p.h) * 2) {
          if (region.colorIdx === activeColor) {
            setRegions(prev => prev.map(r => r.id === region.id ? { ...r, filled: true } : r));
            const newFilled = filled + 1;
            setFilled(newFilled);
            sounds.correct();

            if (newFilled >= regions.length) {
              setDone(true);
              const score = Math.max(50, 300 - errors * 20);
              const stars = calculateStars(score, 300);
              sounds.perfect();
              onComplete({ level, difficulty, score, stars, timeSeconds: 0, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
            }
          } else {
            setErrors(e2 => e2 + 1);
            sounds.wrong();
          }
          return;
        }
      }
    }
  }, [regions, activeColor, filled, done, errors, level, difficulty, onComplete]);

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <div className="text-xs text-white/50 mb-3">Filled: {filled}/{regions.length} &middot; Errors: {errors}</div>

      <canvas ref={canvasRef} onClick={handleCanvasClick} className="rounded-xl mb-4 cursor-pointer" />

      {/* Color palette */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
        {PALETTE.slice(0, colorCount).map((color, i) => (
          <button key={i} onClick={() => setActiveColor(i)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all"
            style={{
              backgroundColor: color,
              border: activeColor === i ? "3px solid white" : "2px solid transparent",
              transform: activeColor === i ? "scale(1.2)" : "scale(1)",
            }}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function KleurBijGetalPage() {
  return (
    <GameWrapper gameSlug="kleur-bij-getal" gameName="Kleur bij Getal">
      {({ level, difficulty, onComplete }) => (
        <ColorByNumberGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
