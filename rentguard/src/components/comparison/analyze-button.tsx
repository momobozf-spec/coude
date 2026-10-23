'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';

const COPY = {
  nl: {
    analyze: 'Analyse uitvoeren',
    running: 'Bezig met analyseren…',
    progress: (done: number, total: number) =>
      `Geanalyseerd: ${done} van ${total}`,
    failed: 'De analyse kon niet worden uitgevoerd.',
    notEntitled: 'Deze formule is nog niet actief voor deze woning.',
    done: 'Analyse afgerond',
  },
  fr: {
    analyze: "Lancer l'analyse",
    running: 'Analyse en cours…',
    progress: (done: number, total: number) => `Analysées : ${done} sur ${total}`,
    failed: "L'analyse n'a pas pu être exécutée.",
    notEntitled: 'Cette formule n’est pas encore active pour ce logement.',
    done: 'Analyse terminée',
  },
} as const;

/**
 * Start de analyse en herhaalt tot alle fotoparen behandeld zijn.
 *
 * De server behandelt per aanroep een klein aantal paren, zodat één verzoek
 * nooit in een tijdslimiet loopt. Deze knop houdt de voortgang bij en toont ze.
 */
export function AnalyzeButton({
  locale,
  inspectionId,
}: {
  locale: Locale;
  inspectionId: string;
}) {
  const t = COPY[locale];
  const router = useRouter();

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMessage(null);
    let analyzedSoFar = 0;

    try {
      // Harde bovengrens zodat een onverwacht antwoord geen eindeloze lus geeft.
      for (let round = 0; round < 40; round += 1) {
        const response = await fetch(
          `/api/inspections/${inspectionId}/compare?locale=${locale}`,
          { method: 'POST' },
        );

        if (response.status === 402) {
          setMessage(t.notEntitled);
          return;
        }
        if (!response.ok) {
          setMessage(t.failed);
          return;
        }

        const payload = (await response.json()) as {
          analyzed: number;
          remaining: number;
          pairs: number;
        };

        analyzedSoFar += payload.analyzed;
        setDone(analyzedSoFar);
        setTotal(payload.pairs);

        if (payload.remaining === 0 || payload.analyzed === 0) break;
      }

      setMessage(t.done);
      router.refresh();
    } catch {
      setMessage(t.failed);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="text-right">
      <Button onClick={() => void run()} disabled={running} variant="secondary">
        {running ? t.running : t.analyze}
      </Button>
      {running && total > 0 ? (
        <p className="mt-1 text-xs text-slate-600">{t.progress(done, total)}</p>
      ) : null}
      {message ? <p className="mt-1 text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
