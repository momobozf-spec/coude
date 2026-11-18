import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PurchasesStoreProduct } from "react-native-purchases";
import { fetchAi } from "./api";
import { paymentsConfigured } from "./config";
import { buyUnlock, getUnlockProduct } from "./purchases";
import { useSession } from "./session";
import { loadUnlock, saveUnlock, type Unlock } from "./unlocks";

export type AiState = "idle" | "loading" | "error";
export type BuyError = "failed" | "not_available" | null;

interface UnlockValue {
  unlock: Unlock | null;
  unlocked: boolean;
  product: PurchasesStoreProduct | null;
  buying: boolean;
  buyError: BuyError;
  aiState: AiState;
  buy: () => Promise<void>;
  retryAi: () => void;
}

const UnlockContext = createContext<UnlockValue | null>(null);

/** One place for purchase + AI state, shared by the overview and the story player. */
export function UnlockProvider({ children }: { children: ReactNode }) {
  const { analysis, locale } = useSession();
  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [product, setProduct] = useState<PurchasesStoreProduct | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<BuyError>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const inFlight = useRef(false);

  useEffect(() => {
    if (paymentsConfigured()) void getUnlockProduct().then(setProduct);
  }, []);

  // New chat: restore an earlier purchase for this chat (by fingerprint) or reset.
  useEffect(() => {
    setUnlock(null);
    setAiState("idle");
    setBuyError(null);
    if (!analysis) return;
    let alive = true;
    void loadUnlock(analysis.fingerprint).then((u) => alive && setUnlock(u));
    return () => {
      alive = false;
    };
  }, [analysis]);

  const requestAi = useCallback(
    async (u: Unlock) => {
      if (!analysis || inFlight.current) return;
      inFlight.current = true;
      setAiState("loading");
      const r = await fetchAi({ ...analysis.bundle.payload, lang: locale }, u.appUserId, u.transactionId);
      inFlight.current = false;
      if (!r.ok) {
        setAiState("error");
        return;
      }
      const next: Unlock = { ...u, ai: r.result };
      setUnlock(next);
      await saveUnlock(analysis.fingerprint, next);
      setAiState("idle");
    },
    [analysis, locale],
  );

  // Paid but no AI result yet (e.g. app closed during generation): fetch it once.
  useEffect(() => {
    if (unlock && !unlock.ai && aiState === "idle") void requestAi(unlock);
  }, [unlock, aiState, requestAi]);

  const buy = useCallback(async () => {
    if (!analysis) return;
    setBuyError(null);
    if (!product) {
      setBuyError("not_available");
      return;
    }
    setBuying(true);
    const r = await buyUnlock(product);
    setBuying(false);
    if (!r.ok) {
      if (!r.cancelled) setBuyError("failed");
      return;
    }
    const u: Unlock = { transactionId: r.transactionId, appUserId: r.appUserId };
    setUnlock(u);
    await saveUnlock(analysis.fingerprint, u);
  }, [analysis, product]);

  const retryAi = useCallback(() => {
    if (unlock) void requestAi(unlock);
  }, [unlock, requestAi]);

  return (
    <UnlockContext.Provider value={{ unlock, unlocked: Boolean(unlock), product, buying, buyError, aiState, buy, retryAi }}>
      {children}
    </UnlockContext.Provider>
  );
}

export function useUnlock(): UnlockValue {
  const v = useContext(UnlockContext);
  if (!v) throw new Error("useUnlock outside UnlockProvider");
  return v;
}
