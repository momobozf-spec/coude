import type { Tone } from "@/lib/slides";

/** "Wrapped" look: dark base, neon gradients, white type. */
export const colors = {
  bg: "#0d0221",
  bgSoft: "#1a0838",
  card: "#1d0c40",
  cardLine: "#3a2270",
  text: "#ffffff",
  textSoft: "#b9a8e6",
  neon: "#ff3d9a",
  lime: "#c6ff3d",
  sun: "#ffd23f",
  cyan: "#3df5ff",
  ink: "#0d0221",
};

export const fonts = {
  medium: "BricolageGrotesque_500Medium",
  semibold: "BricolageGrotesque_600SemiBold",
  bold: "BricolageGrotesque_700Bold",
  black: "BricolageGrotesque_800ExtraBold",
};

export interface ToneStyle {
  gradient: [string, string, string];
  fg: string;
  accent: string;
  glow: string;
}

export const TONE_STYLE: Record<Tone, ToneStyle> = {
  grape: { gradient: ["#12002b", "#3c0a7a", "#ff3d9a"], fg: "#ffffff", accent: "#c6ff3d", glow: "#ff3d9a" },
  pink: { gradient: ["#2a0016", "#c4115f", "#ff9a3d"], fg: "#ffffff", accent: "#ffe14d", glow: "#ffd23f" },
  sun: { gradient: ["#1c0a00", "#a34100", "#ffc83d"], fg: "#ffffff", accent: "#3df5ff", glow: "#ffe14d" },
  sky: { gradient: ["#000c2b", "#0d3fa6", "#3df5ff"], fg: "#ffffff", accent: "#ff3d9a", glow: "#3df5ff" },
  lilac: { gradient: ["#0d0221", "#5a1ab8", "#c6ff3d"], fg: "#ffffff", accent: "#ff3d9a", glow: "#c6ff3d" },
};

/** Big emoji per slide, keyed by slide key (or its prefix). */
export function slideEmoji(key: string): string {
  const map: Record<string, string> = {
    total: "💬",
    busiest: "🚨",
    days: "✅",
    "award-spammer": "🏆",
    "award-ghost": "👻",
    "award-nightOwl": "🦉",
    "award-voiceKing": "🎙️",
    "award-fastest": "⚡",
    "award-starter": "🔥",
    "award-novelist": "📚",
    "award-questioner": "❓",
    "award-laugher": "😂",
    "award-stickers": "🧩",
    "award-deleter": "🗑️",
    ranking: "🥇",
    peak: "⏰",
    hours: "⏰",
    months: "📊",
    summary: "🎉",
    streak: "📈",
    month: "🗓️",
    duo: "👯",
    emojis: "😍",
    words: "💭",
    "ai-personality": "🎭",
    "ai-prediction": "🔮",
    "ai-motto": "📣",
    outro: "👋",
  };
  if (map[key]) return map[key];
  if (key.startsWith("ai-moment")) return "🎬";
  if (key.startsWith("ai-roast")) return "🌶️";
  return "✨";
}
