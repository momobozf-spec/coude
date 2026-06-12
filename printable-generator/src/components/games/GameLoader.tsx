"use client";

import { useEffect, useState } from "react";

interface GameLoaderProps {
  gameId: string;
  title: string;
  emoji: string;
}

export function GameLoader({ gameId, title, emoji }: GameLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsLoading(false);
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0f3d2a, #1a6b4a)" }}
    >
      <div className="text-center text-white">
        <div className="text-8xl mb-6 animate-float">{emoji}</div>
        <h2 className="text-3xl font-bold mb-2">{title}</h2>
        <p className="text-emerald-300 mb-8">Spel laden...</p>
        <div className="w-64 h-2 rounded-full bg-emerald-800 overflow-hidden mx-auto">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: "linear-gradient(90deg, #c9920a, #f9d24d)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
