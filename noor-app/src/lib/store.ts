import AsyncStorage from "@react-native-async-storage/async-storage";

// Simple store using AsyncStorage (no Zustand/MMKV needed for MVP)
interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "PRO" | "SCHOOL" | "ADMIN";
  subscriptionPlan?: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  isOnboarded: boolean;
  gameScores: Record<string, number>;
}

let state: AppState = {
  user: null,
  token: null,
  isOnboarded: false,
  gameScores: {},
};

const STORAGE_KEY = "noor_store";

export async function loadStore() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch { /* silent */ }
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* silent */ }
}

export function getState() { return state; }
export function getUser() { return state.user; }
export function getToken() { return state.token; }
export function isPro() { return state.user?.role === "PRO" || state.user?.role === "SCHOOL" || state.user?.role === "ADMIN"; }

export async function setUser(user: User | null) { state.user = user; await persist(); }
export async function setToken(token: string | null) { state.token = token; await persist(); }
export async function setOnboarded() { state.isOnboarded = true; await persist(); }
export async function setGameScore(gameId: string, score: number) {
  state.gameScores[gameId] = Math.max(score, state.gameScores[gameId] ?? 0);
  await persist();
}
export async function logout() { state.user = null; state.token = null; await persist(); }
