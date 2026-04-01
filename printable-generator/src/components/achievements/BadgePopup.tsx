"use client";

import { useEffect, useState } from "react";

interface Props {
  badge: { name: string; iconEmoji: string; tier: string; xpReward: number } | null;
  levelUp?: { level: number; levelName: string } | null;
  onClose: () => void;
}

export default function BadgePopup({ badge, levelUp, onClose }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (badge || levelUp) {
      setShow(true);
      const timer = setTimeout(() => { setShow(false); setTimeout(onClose, 300); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [badge, levelUp, onClose]);

  if (!badge && !levelUp) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none" style={{ transition: "opacity 0.3s", opacity: show ? 1 : 0 }}>
      <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm mx-4" style={{ animation: show ? "badgeBounce 0.6s ease" : undefined }}>
        <style>{`@keyframes badgeBounce { 0% { transform: scale(0) translateY(-50px); } 50% { transform: scale(1.1) translateY(0); } 100% { transform: scale(1) translateY(0); } }`}</style>

        {badge && (
          <>
            <div className="text-6xl mb-3">{badge.iconEmoji}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">Badge Earned!</h2>
            <p className="text-lg font-bold" style={{ color: "#1a6b4a" }}>{badge.name}</p>
            <p className="text-sm text-gray-500 mt-1">+{badge.xpReward} XP &middot; {badge.tier.toUpperCase()}</p>
          </>
        )}

        {levelUp && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-bold" style={{ color: "#c9920a" }}>&#11088; Level Up!</p>
            <p className="text-lg font-extrabold">Level {levelUp.level}: {levelUp.levelName}</p>
          </div>
        )}

        <button onClick={() => { setShow(false); onClose(); }} className="mt-4 text-xs text-gray-400 hover:text-gray-600">
          Continue
        </button>
      </div>
    </div>
  );
}
