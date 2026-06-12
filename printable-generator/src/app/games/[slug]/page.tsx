"use client";

import Link from "next/link";
import { useRef, useEffect, useState, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { MemoryGame } from "@/lib/games/memory-game";
import { ArabicGame } from "@/lib/games/arabic-game";
import { KaabaGame } from "@/lib/games/kaaba-game";
import { getRandomFact } from "@/lib/games/game-facts";
import { isSoundEnabled, setSoundEnabled } from "@/lib/games/game-sounds";

const ENGINES = { memory: MemoryGame, arabic: ArabicGame, kaaba: KaabaGame };
const NAMES: Record<string, string> = { memory: "Moskee Memory", arabic: "Arabische Letter Vangen", kaaba: "Bouw de Kaaba" };

export default function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<InstanceType<typeof MemoryGame | typeof ArabicGame | typeof KaabaGame> | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [fact, setFact] = useState("");
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);

  const submitScore = useCallback(async (s: number, meta: Record<string, number>) => {
    if (!session) return;
    try {
      const res = await fetch("/api/games/score", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameSlug: slug, score: s, metadata: meta }),
      });
      const data = await res.json();
      if (data.newBest) setNewBest(true);
      if (data.xpGained) setXpGained(data.xpGained);
    } catch { /* silent */ }
  }, [session, slug]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setFact(getRandomFact(slug));
    const Engine = ENGINES[slug as keyof typeof ENGINES];
    if (!Engine) return;

    const game = new Engine(canvas, {
      onScore: (s: number) => setScore(s),
      onGameOver: (s: number, meta: Record<string, number>) => {
        setFinalScore(s); setGameOver(true);
        setFact(getRandomFact(slug));
        submitScore(s, meta);
      },
    });

    gameRef.current = game;
    game.init();

    return () => game.destroy();
  }, [slug, submitScore]);

  function handleCanvasClick(e: React.MouseEvent) { gameRef.current?.handleClick(e); }
  function handleCanvasTouch(e: React.TouchEvent) { e.preventDefault(); gameRef.current?.handleTouch(e); }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0f172a" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <Link href="/games" className="text-xs text-white/40 hover:text-white">&#8592; Games</Link>
        <span className="text-sm font-bold text-white">{NAMES[slug] || slug}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "#c9920a" }}>{score}</span>
          <button onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); }} className="text-xs text-white/40">
            {soundOn ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          className="w-full max-w-lg"
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasTouch}
        />
      </div>

      {/* Game over overlay */}
      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="rounded-2xl p-6 text-center max-w-sm w-full" style={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-4xl mb-2">{newBest ? "🎉" : "🏆"}</div>
            <h2 className="text-xl font-bold text-white mb-1">{newBest ? "New Personal Best!" : "Game Over!"}</h2>
            <p className="text-2xl font-extrabold mb-1" style={{ color: "#c9920a" }}>{finalScore} pts</p>
            {xpGained > 0 && <p className="text-sm text-white/50 mb-3">+{xpGained} XP</p>}

            <div className="rounded-lg p-3 mb-4 text-xs text-white/40" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
              💡 {fact}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setGameOver(false); setScore(0); setNewBest(false); setXpGained(0); gameRef.current?.init(); }}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm text-white" style={{ backgroundColor: "#1a6b4a" }}>
                Play Again
              </button>
              <Link href="/games" className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center text-white/60" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                Other Games
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom fact */}
      <div className="px-4 py-2 text-center border-t border-white/5">
        <p className="text-[10px] text-white/20">💡 {fact}</p>
      </div>
    </div>
  );
}
