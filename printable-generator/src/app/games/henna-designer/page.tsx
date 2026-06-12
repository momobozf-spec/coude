"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

const STAMPS = ["✿", "❋", "❃", "✦", "◆", "●", "✸", "❂", "✻", "☘", "❁", "✤"];
const HENNA_COLOR = "#8B4513";

function HennaDesignerGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stampCount = difficulty === "easy" ? 5 : difficulty === "medium" ? 8 : 12;
  const [activeStamp, setActiveStamp] = useState(0);
  const [tool, setTool] = useState<"stamp" | "draw">("stamp");
  const [symmetry, setSymmetry] = useState(difficulty !== "easy");
  const [isDrawing, setIsDrawing] = useState(false);
  const [placements, setPlacements] = useState(0);
  const [history, setHistory] = useState<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 600; canvas.height = 750;
    canvas.style.width = "300px"; canvas.style.height = "375px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = "#fdf6e3"; ctx.fillRect(0, 0, 300, 375);

    // Hand silhouette (simplified)
    ctx.fillStyle = "#f5deb3";
    ctx.beginPath();
    ctx.ellipse(150, 250, 55, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fingers
    for (let i = 0; i < 5; i++) {
      const angle = -0.5 + i * 0.25;
      const fx = 150 + Math.sin(angle) * 50;
      const fy = 170 - Math.cos(angle) * (i === 2 ? 80 : i === 1 || i === 3 ? 70 : 55);
      ctx.beginPath();
      ctx.ellipse(fx, fy, 10, 25, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wrist
    ctx.fillRect(105, 320, 90, 55);

    ctx.strokeStyle = "#d2b48c"; ctx.lineWidth = 1;
    ctx.stroke();

    setHistory([ctx.getImageData(0, 0, 600, 750)]);
    setPlacements(0);
  }, [level, difficulty]);

  const placeStamp = useCallback((e: React.MouseEvent) => {
    if (tool !== "stamp") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 2;
    const y = (e.clientY - rect.top) * 2;

    ctx.fillStyle = HENNA_COLOR;
    ctx.font = "24px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(STAMPS[activeStamp], x, y);

    if (symmetry) {
      ctx.fillText(STAMPS[activeStamp], 600 - x, y); // mirror horizontal
    }

    sounds.correct();
    setPlacements(p => p + 1);
    setHistory(prev => [...prev.slice(-19), ctx.getImageData(0, 0, 600, 750)]);
  }, [tool, activeStamp, symmetry]);

  const startDraw = useCallback((e: React.MouseEvent) => {
    if (tool !== "draw") return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * 2, (e.clientY - rect.top) * 2);
    ctx.strokeStyle = HENNA_COLOR; ctx.lineWidth = 3; ctx.lineCap = "round";
  }, [tool]);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || tool !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 2;
    const y = (e.clientY - rect.top) * 2;
    ctx.lineTo(x, y); ctx.stroke();
    if (symmetry) {
      ctx.moveTo(600 - x, y); ctx.lineTo(600 - x, y); ctx.stroke();
      ctx.moveTo(x, y);
    }
  }, [isDrawing, tool, symmetry]);

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setPlacements(p => p + 1);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d")!;
      setHistory(prev => [...prev.slice(-19), ctx.getImageData(0, 0, 600, 750)]);
    }
  }, [isDrawing]);

  const undo = useCallback(() => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
    }
  }, [history]);

  const save = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `noor-henna-${level}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [level]);

  const complete = () => {
    const score = placements * 10;
    onComplete({ level, difficulty, score, stars: placements >= 10 ? 3 : placements >= 5 ? 2 : 1, timeSeconds: 0, xpEarned: XP_PER_DIFFICULTY[difficulty] });
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <p className="text-xs text-white/40 mb-2">Decorate the hand with henna patterns</p>

      <canvas ref={canvasRef} className="rounded-xl mb-3 cursor-crosshair"
        onClick={placeStamp} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} />

      {/* Tools */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTool("stamp")} className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: tool === "stamp" ? "#c9920a" : "rgba(255,255,255,0.1)", color: "#fff" }}>✿ Stamp</button>
        {difficulty !== "easy" && (
          <button onClick={() => setTool("draw")} className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: tool === "draw" ? "#c9920a" : "rgba(255,255,255,0.1)", color: "#fff" }}>✏️ Draw</button>
        )}
        {difficulty !== "easy" && (
          <button onClick={() => setSymmetry(!symmetry)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: symmetry ? "#1a6b4a" : "rgba(255,255,255,0.1)", color: "#fff" }}>↔ Mirror</button>
        )}
      </div>

      {/* Stamps */}
      {tool === "stamp" && (
        <div className="flex flex-wrap gap-1.5 justify-center max-w-xs mb-3">
          {STAMPS.slice(0, stampCount).map((s, i) => (
            <button key={i} onClick={() => setActiveStamp(i)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all"
              style={{ backgroundColor: activeStamp === i ? "rgba(139,69,19,0.3)" : "rgba(255,255,255,0.06)", border: activeStamp === i ? "2px solid #8B4513" : "1px solid rgba(255,255,255,0.1)", transform: activeStamp === i ? "scale(1.15)" : "scale(1)" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={undo} className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/50">↩ Undo</button>
        <button onClick={save} className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/50">💾 Save</button>
        <button onClick={complete} className="text-xs px-3 py-1.5 rounded font-bold text-white" style={{ backgroundColor: "#1a6b4a" }}>✓ Done</button>
      </div>
    </div>
  );
}

export default function HennaDesignerPage() {
  return (
    <GameWrapper gameSlug="henna-designer" gameName="Henna Designer">
      {({ level, difficulty, onComplete }) => (
        <HennaDesignerGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
