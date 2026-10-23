import { getToken, logout } from "./store";

export const API_URL = __DEV__
  ? "http://10.0.2.2:3000/api"
  : "https://noorprintables.com/api";

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export const gamesAPI = {
  saveScore: (gameSlug: string, score: number, metadata?: Record<string, unknown>) =>
    api.post("/games/score", { gameSlug, score, metadata }),
  leaderboard: (game: string) => api.get(`/games/leaderboard?game=${game}`),
};
