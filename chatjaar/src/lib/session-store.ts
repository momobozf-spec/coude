"use client";

import type { ChatStats } from "./stats";
import type { AiBundle } from "./ai-payload";
import type { AiResult } from "./ai-types";

// Everything lives in sessionStorage: it survives the redirect to Stripe and back
// in the same tab, and disappears when the tab is closed.
const KEY = "chatjaar:analysis:v1";
const AI_KEY = "chatjaar:ai:v1:";

export interface StoredAnalysis {
  stats: ChatStats;
  bundle: AiBundle;
  createdAt: number;
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage full or blocked (private mode). The result page falls back to re-upload.
  }
}

export function saveAnalysis(a: StoredAnalysis) {
  safeSet(KEY, JSON.stringify(a));
}

export function loadAnalysis(): StoredAnalysis | null {
  const raw = safeGet(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAnalysis;
  } catch {
    return null;
  }
}

export function saveAiResult(sessionId: string, r: AiResult) {
  safeSet(AI_KEY + sessionId, JSON.stringify(r));
}

export function loadAiResult(sessionId: string): AiResult | null {
  const raw = safeGet(AI_KEY + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiResult;
  } catch {
    return null;
  }
}

export function clearAll() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("chatjaar:")) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
