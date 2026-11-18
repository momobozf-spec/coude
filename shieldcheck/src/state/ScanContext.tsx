import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { actionsFromResults, generalTips, type ActionItem } from '../scan/actions';
import { runScan } from '../scan/runScan';
import { computeScore, type ScoreBreakdown } from '../scan/score';
import type { ScanReport } from '../scan/types';
import { loadCompletedActions, loadOnboarded, saveCompletedActions, saveOnboarded } from './storage';

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

interface ScanContextValue {
  ready: boolean;
  onboarded: boolean;
  completeOnboarding: () => Promise<void>;
  status: ScanStatus;
  report: ScanReport | null;
  error: string | null;
  startScan: () => Promise<void>;
  findingActions: ActionItem[];
  tips: ActionItem[];
  completedActions: Set<string>;
  toggleAction: (id: string) => void;
  score: ScoreBreakdown;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ob, done] = await Promise.all([loadOnboarded(), loadCompletedActions()]);
      if (!alive) return;
      setOnboarded(ob);
      setCompleted(done);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const startScan = useCallback(async () => {
    setStatus('scanning');
    setError(null);
    try {
      const next = await runScan();
      setReport(next);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
      setStatus('error');
    }
  }, []);

  // Scan automatisch zodra de gebruiker de introductie heeft afgerond.
  useEffect(() => {
    if (ready && onboarded && status === 'idle') void startScan();
  }, [ready, onboarded, status, startScan]);

  const completeOnboarding = useCallback(async () => {
    await saveOnboarded(true);
    setOnboarded(true);
  }, []);

  const findingActions = useMemo(() => (report ? actionsFromResults(report.results) : []), [report]);
  const tips = useMemo(() => generalTips(), []);
  const completedActions = useMemo(() => new Set(completed), [completed]);

  const toggleAction = useCallback((id: string) => {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      void saveCompletedActions(next);
      return next;
    });
  }, []);

  const score = useMemo(() => {
    const confirmedCheckIds = new Set(
      findingActions.filter((a) => a.checkId && completedActions.has(a.id)).map((a) => a.checkId as string),
    );
    return computeScore(report?.results ?? [], confirmedCheckIds);
  }, [report, findingActions, completedActions]);

  const value: ScanContextValue = {
    ready,
    onboarded,
    completeOnboarding,
    status,
    report,
    error,
    startScan,
    findingActions,
    tips,
    completedActions,
    toggleAction,
    score,
  };

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan moet binnen <ScanProvider> gebruikt worden');
  return ctx;
}
