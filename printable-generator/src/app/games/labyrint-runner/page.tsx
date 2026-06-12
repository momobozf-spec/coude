"use client";

import { useRef, useEffect, useState, useCallback, use } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

interface Cell { top: boolean; right: boolean; bottom: boolean; left: boolean; visited: boolean; }

function generateMaze(cols: number, rows: number, seed: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ top: true, right: true, bottom: true, left: true, visited: false })));
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const stack: [number, number][] = [];
  let cur: [number, number] = [0, 0];
  grid[0][0].visited = true;
  stack.push(cur);

  while (stack.length) {
    const [cr, cc] = cur;
    const neighbors: [number, number, string, string][] = [];
    if (cr > 0 && !grid[cr - 1][cc].visited) neighbors.push([cr - 1, cc, "top", "bottom"]);
    if (cr < rows - 1 && !grid[cr + 1][cc].visited) neighbors.push([cr + 1, cc, "bottom", "top"]);
    if (cc > 0 && !grid[cr][cc - 1].visited) neighbors.push([cr, cc - 1, "left", "right"]);
    if (cc < cols - 1 && !grid[cr][cc + 1].visited) neighbors.push([cr, cc + 1, "right", "left"]);

    if (neighbors.length) {
      const [nr, nc, w1, w2] = neighbors[Math.floor(rand() * neighbors.length)];
      (grid[cr][cc] as unknown as Record<string, boolean>)[w1] = false;
      (grid[nr][nc] as unknown as Record<string, boolean>)[w2] = false;
      grid[nr][nc].visited = true;
      stack.push(cur);
      cur = [nr, nc];
    } else {
      cur = stack.pop()!;
    }
  }
  return grid;
}

function MazeGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mazeSize = difficulty === "easy" ? 9 : difficulty === "medium" ? 13 : 19;
  const timeLimit = difficulty === "easy" ? 0 : difficulty === "medium" ? 60 : 45;

  const [maze, setMaze] = useState<Cell[][]>([]);
  const [playerPos, setPlayerPos] = useState<[number, number]>([0, 0]);
  const [stars, setStars] = useState(0);
  const [timer, setTimer] = useState(timeLimit);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setMaze(generateMaze(mazeSize, mazeSize, level * 1000 + mazeSize));
    setPlayerPos([0, 0]); setStars(0); setTimer(timeLimit); setMoves(0); setDone(false);
  }, [level, difficulty, mazeSize, timeLimit]);

  // Timer
  useEffect(() => {
    if (done || timeLimit === 0) return;
    if (timer <= 0) { setDone(true); onComplete({ level, difficulty, score: stars * 10, stars: 1, timeSeconds: timeLimit, xpEarned: XP_PER_DIFFICULTY[difficulty] }); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, done, timeLimit]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maze.length) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    const size = Math.min(rect?.width || 400, (rect?.height || 500) - 60);
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    const cellSize = size / mazeSize;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, size, size);

    // Walls
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.5;
    for (let r = 0; r < mazeSize; r++) {
      for (let c = 0; c < mazeSize; c++) {
        const x = c * cellSize, y = r * cellSize;
        if (maze[r][c].top) { ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); ctx.stroke(); ctx.beginPath(); }
        if (maze[r][c].right) { ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke(); ctx.beginPath(); }
        if (maze[r][c].bottom) { ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke(); ctx.beginPath(); }
        if (maze[r][c].left) { ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); ctx.stroke(); ctx.beginPath(); }
      }
    }

    // Goal (mosque)
    const gx = (mazeSize - 1) * cellSize + cellSize / 2, gy = (mazeSize - 1) * cellSize + cellSize / 2;
    ctx.fillStyle = "#1a6b4a"; ctx.font = `${cellSize * 0.6}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🕌", gx, gy);

    // Player (crescent)
    const px = playerPos[1] * cellSize + cellSize / 2, py = playerPos[0] * cellSize + cellSize / 2;
    ctx.fillStyle = "#c9920a"; ctx.font = `${cellSize * 0.6}px serif`;
    ctx.fillText("🌙", px, py);

    // Star collectibles (simple random placement)
    for (let i = 0; i < 3; i++) {
      const sr = (level * 3 + i * 7) % mazeSize, sc = (level * 5 + i * 11) % mazeSize;
      if (sr !== playerPos[0] || sc !== playerPos[1]) {
        ctx.fillStyle = "#c9920a"; ctx.font = `${cellSize * 0.35}px serif`;
        ctx.fillText("⭐", sc * cellSize + cellSize / 2, sr * cellSize + cellSize / 2);
      }
    }
  }, [maze, playerPos, mazeSize, level]);

  const move = useCallback((dr: number, dc: number) => {
    if (done) return;
    const [r, c] = playerPos;
    const cell = maze[r]?.[c];
    if (!cell) return;

    if (dr === -1 && cell.top) return;
    if (dr === 1 && cell.bottom) return;
    if (dc === -1 && cell.left) return;
    if (dc === 1 && cell.right) return;

    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= mazeSize || nc < 0 || nc >= mazeSize) return;

    setPlayerPos([nr, nc]);
    setMoves(m => m + 1);
    sounds.correct();

    // Check star collection
    for (let i = 0; i < 3; i++) {
      const sr = (level * 3 + i * 7) % mazeSize, sc = (level * 5 + i * 11) % mazeSize;
      if (nr === sr && nc === sc) { setStars(s => s + 1); sounds.match(); }
    }

    // Check win
    if (nr === mazeSize - 1 && nc === mazeSize - 1) {
      setDone(true);
      const finalScore = 100 + stars * 20 + Math.max(0, (timeLimit || 120) - moves) * 2;
      const s = calculateStars(finalScore, 200);
      sounds.perfect();
      onComplete({ level, difficulty, score: finalScore, stars: s, timeSeconds: timeLimit - timer, xpEarned: XP_PER_DIFFICULTY[difficulty] * s });
    }
  }, [playerPos, maze, mazeSize, done, level, stars, moves, timer, timeLimit, difficulty, onComplete]);

  // Keyboard
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") move(-1, 0);
      else if (e.key === "ArrowDown") move(1, 0);
      else if (e.key === "ArrowLeft") move(0, -1);
      else if (e.key === "ArrowRight") move(0, 1);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [move]);

  // Swipe
  const touchStart = useRef<[number, number] | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = [e.touches[0].clientX, e.touches[0].clientY]; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current[0];
    const dy = e.changedTouches[0].clientY - touchStart.current[1];
    if (Math.abs(dx) > Math.abs(dy)) { if (dx > 20) move(0, 1); else if (dx < -20) move(0, -1); }
    else { if (dy > 20) move(1, 0); else if (dy < -20) move(-1, 0); }
    touchStart.current = null;
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <div className="w-full max-w-lg flex justify-between text-sm text-white/60 mb-2">
        <span>Moves: {moves}</span>
        <span>⭐ {stars}</span>
        {timeLimit > 0 && <span style={{ color: timer <= 10 ? "#dc2626" : undefined }}>⏱ {timer}s</span>}
      </div>
      <div className="flex-1 flex items-center" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <canvas ref={canvasRef} />
      </div>
      {/* Mobile controls */}
      <div className="mt-3 grid grid-cols-3 gap-1 w-32">
        <div />
        <button onClick={() => move(-1, 0)} className="p-2 rounded bg-white/10 text-white text-center">↑</button>
        <div />
        <button onClick={() => move(0, -1)} className="p-2 rounded bg-white/10 text-white text-center">←</button>
        <button onClick={() => move(1, 0)} className="p-2 rounded bg-white/10 text-white text-center">↓</button>
        <button onClick={() => move(0, 1)} className="p-2 rounded bg-white/10 text-white text-center">→</button>
      </div>
    </div>
  );
}

export default function LabyrintPage() {
  return (
    <GameWrapper gameSlug="labyrint-runner" gameName="Labyrint Runner">
      {({ level, difficulty, onComplete }) => (
        <MazeGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
