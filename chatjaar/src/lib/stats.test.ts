import { describe, expect, it } from "vitest";
import { parseChat } from "./parser";
import { computeStats } from "./stats";
import { buildAiBundle, memberCode, restoreNames } from "./ai-payload";

function chat(lines: Array<[string, string, string]>) {
  // [dd-mm-yyyy hh:mm, sender, text]
  return lines.map(([ts, s, t]) => `${ts} - ${s}: ${t}`).join("\n");
}

const SAMPLE = chat([
  ["31-12-2025 23:00", "Sara", "vorig jaar telt niet"],
  ["01-01-2026 00:30", "Sara", "Gelukkig nieuwjaar 🎉"],
  ["01-01-2026 00:31", "Yassine", "jij ook 🎉🎉 haha"],
  ["01-01-2026 00:35", "Lina", "wie komt er morgen pizza eten?"],
  ["01-01-2026 00:36", "Sara", "hahaha ik ben er bij"],
  ["02-01-2026 12:00", "Yassine", "pizza was top, bel me op +32 470 12 34 56"],
  ["03-01-2026 12:00", "Yassine", "<Media weggelaten>"],
  ["03-01-2026 13:00", "Sara", "PTT-20260103-WA0001.opus (bestand bijgevoegd)"],
  ["20-02-2026 09:00", "Sara", "pizza pizza pizza"],
]);

describe("computeStats", () => {
  const parsed = parseChat(SAMPLE);
  const stats = computeStats(parsed.messages);

  it("only counts the most recent year", () => {
    expect(stats.year).toBe(2026);
    expect(stats.totalMessages).toBe(8);
  });

  it("computes per-member numbers", () => {
    const sara = stats.members.find((m) => m.name === "Sara")!;
    expect(sara.messages).toBe(4);
    expect(sara.night).toBe(2);
    expect(sara.voice).toBe(1);
    expect(stats.members[0].name).toBe("Sara");
  });

  it("finds streaks, busiest day, words and emojis", () => {
    expect(stats.longestStreak).toEqual({ days: 3, start: "2026-01-01", end: "2026-01-03" });
    expect(stats.busiestDay).toEqual({ date: "2026-01-01", count: 4 });
    expect(stats.topWords[0]).toEqual({ word: "pizza", count: 5 });
    expect(stats.topEmojis[0]).toEqual({ emoji: "🎉", count: 3 });
    expect(stats.voiceDetected).toBe(true);
  });

  it("hands out awards", () => {
    const ids = stats.awards.map((a) => a.id);
    expect(ids).toContain("spammer");
    expect(ids).toContain("ghost");
    expect(stats.awards.find((a) => a.id === "spammer")!.winner).toBe("Sara");
    expect(stats.awards.find((a) => a.id === "ghost")!.winner).toBe("Lina");
    expect(stats.awards.find((a) => a.id === "voiceKing")!.winner).toBe("Sara");
  });
});

describe("buildAiBundle", () => {
  const parsed = parseChat(SAMPLE);
  const stats = computeStats(parsed.messages);
  const { payload, codeToName } = buildAiBundle(parsed.messages, stats, "nl");
  const json = JSON.stringify(payload);

  it("never sends real names or phone numbers", () => {
    for (const name of ["Sara", "Yassine", "Lina"]) expect(json).not.toContain(name);
    expect(json).not.toContain("470");
    expect(json).toContain("[nummer]");
  });

  it("detects funny moments from laughter replies", () => {
    expect(payload.moments.length).toBeGreaterThan(0);
  });

  it("maps codes back to names", () => {
    expect(restoreNames(`${memberCode(0)} is de baas van ${memberCode(1)}`, codeToName)).toBe("Sara is de baas van Yassine");
    expect(memberCode(26)).toBe("Lid AA");
  });
});
