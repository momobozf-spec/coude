import { AVATARS, type AvatarId } from "@/lib/validators";

/**
 * Avatars are drawn as emoji on a tinted disc. No image assets, no network
 * requests, no licensing questions, and they scale perfectly on every screen.
 */
const AVATAR_GLYPHS: Record<AvatarId, string> = {
  fox: "🦊",
  cat: "🐱",
  owl: "🦉",
  lion: "🦁",
  bee: "🐝",
  star: "⭐",
};

const AVATAR_TINTS: Record<AvatarId, string> = {
  fox: "bg-orange-100",
  cat: "bg-pink-100",
  owl: "bg-indigo-100",
  lion: "bg-amber-100",
  bee: "bg-yellow-100",
  star: "bg-gold-light",
};

export function isAvatarId(value: string): value is AvatarId {
  return (AVATARS as readonly string[]).includes(value);
}

export function avatarGlyph(value: string): string {
  return isAvatarId(value) ? AVATAR_GLYPHS[value] : AVATAR_GLYPHS.fox;
}

export function avatarTint(value: string): string {
  return isAvatarId(value) ? AVATAR_TINTS[value] : AVATAR_TINTS.fox;
}

export { AVATARS };
export type { AvatarId };
