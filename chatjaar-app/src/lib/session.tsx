import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Analysis } from "./analyze";
import { deviceLocale } from "@/i18n/app";
import type { Locale } from "@/i18n/dictionaries";

interface SessionValue {
  locale: Locale;
  analysis: Analysis | null;
  setAnalysis: (a: Analysis | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** In-memory only: the parsed chat never touches disk. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const locale = useMemo(() => deviceLocale(), []);
  return <SessionContext.Provider value={{ locale, analysis, setAnalysis }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
