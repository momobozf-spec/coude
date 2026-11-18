import type { ChatStats } from "./stats";

/** Non-reversible fingerprint of a chat (FNV-1a over aggregate stats), no message content. */
export function fingerprint(stats: ChatStats): string {
  const basis = [
    stats.year,
    stats.totalMessages,
    stats.totalWords,
    stats.busiestDay.date,
    stats.members.map((m) => `${m.name}:${m.messages}`).join("|"),
  ].join("#");
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
