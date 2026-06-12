"use client";

import { useState, useEffect, useCallback } from "react";
import GameWrapper from "@/components/games/GameWrapper";
import { Difficulty, LevelResult, XP_PER_DIFFICULTY, calculateStars } from "@/lib/games/game-types";
import { sounds } from "@/lib/games/game-sounds";

const ARABIC_LETTERS = [
  { ar: "أ", name: "Alif", sound: "/a/" }, { ar: "ب", name: "Ba", sound: "/b/" },
  { ar: "ت", name: "Ta", sound: "/t/" }, { ar: "ث", name: "Tha", sound: "/th/" },
  { ar: "ج", name: "Jim", sound: "/j/" }, { ar: "ح", name: "Ha", sound: "/h/" },
  { ar: "خ", name: "Kha", sound: "/kh/" }, { ar: "د", name: "Dal", sound: "/d/" },
  { ar: "ذ", name: "Dhal", sound: "/dh/" }, { ar: "ر", name: "Ra", sound: "/r/" },
  { ar: "ز", name: "Zay", sound: "/z/" }, { ar: "س", name: "Sin", sound: "/s/" },
  { ar: "ش", name: "Shin", sound: "/sh/" }, { ar: "ص", name: "Sad", sound: "/ṣ/" },
];

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

interface Card { id: number; content: string; pairId: number; flipped: boolean; matched: boolean; type: "arabic" | "name"; }

function LetterMatchGame({ level, difficulty, onComplete }: { level: number; difficulty: Difficulty; onComplete: (r: LevelResult) => void }) {
  const pairCount = difficulty === "easy" ? 4 : difficulty === "medium" ? 8 : 12;
  const timeLimit = difficulty === "easy" ? 60 : difficulty === "medium" ? 45 : 30;

  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timer, setTimer] = useState(timeLimit);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const letters = shuffle(ARABIC_LETTERS).slice(0, pairCount);
    const cardPairs: Card[] = [];
    letters.forEach((l, i) => {
      cardPairs.push({ id: i * 2, content: l.ar, pairId: i, flipped: false, matched: false, type: "arabic" });
      cardPairs.push({ id: i * 2 + 1, content: difficulty === "hard" ? l.sound : l.name, pairId: i, flipped: false, matched: false, type: "name" });
    });
    setCards(shuffle(cardPairs));
    setFlipped([]); setScore(0); setMoves(0); setMatches(0); setCombo(0); setTimer(timeLimit); setDone(false); setStarted(false);
  }, [level, difficulty, pairCount, timeLimit]);

  useEffect(() => {
    if (!started || done) return;
    if (timer <= 0) {
      setDone(true);
      const stars = calculateStars(matches, pairCount);
      onComplete({ level, difficulty, score, stars, timeSeconds: timeLimit, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
      return;
    }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, started, done]);

  const handleFlip = useCallback((id: number) => {
    if (done || flipped.length >= 2) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;

    if (!started) setStarted(true);

    const newCards = cards.map(c => c.id === id ? { ...c, flipped: true } : c);
    setCards(newCards);
    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = newFlipped.map(fid => newCards.find(c => c.id === fid)!);

      if (a.pairId === b.pairId && a.type !== b.type) {
        // Match!
        const newCombo = combo + 1;
        setCombo(newCombo);
        const pts = 20 + newCombo * 5;
        setScore(s => s + pts);
        setMatches(m => m + 1);
        sounds.match();

        setCards(prev => prev.map(c => c.pairId === a.pairId ? { ...c, matched: true } : c));
        setFlipped([]);

        if (matches + 1 >= pairCount) {
          setDone(true);
          const finalScore = score + pts + Math.max(0, timer * 3);
          const stars = calculateStars(finalScore, pairCount * 40);
          sounds.perfect();
          onComplete({ level, difficulty, score: finalScore, stars, timeSeconds: timeLimit - timer, xpEarned: XP_PER_DIFFICULTY[difficulty] * stars });
        }
      } else {
        setCombo(0);
        sounds.wrong();
        setTimeout(() => {
          setCards(prev => prev.map(c => newFlipped.includes(c.id) ? { ...c, flipped: false } : c));
          setFlipped([]);
        }, 800);
      }
    }
  }, [cards, flipped, done, started, combo, score, matches, pairCount, timer, timeLimit, level, difficulty, onComplete]);

  const cols = pairCount <= 4 ? 4 : pairCount <= 8 ? 4 : 6;

  return (
    <div className="flex-1 flex flex-col items-center p-4">
      <div className="w-full max-w-lg flex justify-between text-sm text-white/60 mb-3">
        <span>Matches: {matches}/{pairCount}</span>
        <span>Score: {score}{combo > 1 && <span style={{ color: "#c9920a" }}> {combo}x</span>}</span>
        <span style={{ color: timer <= 10 ? "#dc2626" : undefined }}>⏱ {timer}s</span>
      </div>

      <div className="flex-1 flex items-center">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, maxWidth: 400 }}>
          {cards.map(card => (
            <button key={card.id} onClick={() => handleFlip(card.id)}
              className="aspect-square rounded-lg flex items-center justify-center transition-all"
              style={{
                width: 60 + (pairCount <= 4 ? 20 : 0),
                backgroundColor: card.matched ? "rgba(26,107,74,0.3)" : card.flipped ? "#1e293b" : "#334155",
                border: card.matched ? "2px solid #1a6b4a" : card.flipped ? "2px solid #c9920a" : "1px solid rgba(255,255,255,0.1)",
                transform: card.flipped || card.matched ? "scale(1)" : "scale(0.95)",
              }}>
              {card.flipped || card.matched ? (
                <span className={card.type === "arabic" ? "text-2xl" : "text-xs font-bold text-white"} style={card.type === "arabic" ? { fontFamily: "'Amiri', serif", color: "#fff" } : {}}>
                  {card.content}
                </span>
              ) : (
                <span className="text-lg" style={{ color: "#c9920a" }}>🌙</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ArabicLetterMatchPage() {
  return (
    <GameWrapper gameSlug="arabic-letter-match" gameName="Arabic Letter Match">
      {({ level, difficulty, onComplete }) => (
        <LetterMatchGame level={level} difficulty={difficulty} onComplete={onComplete} />
      )}
    </GameWrapper>
  );
}
