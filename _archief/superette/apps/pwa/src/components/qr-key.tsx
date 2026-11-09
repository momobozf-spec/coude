'use client';

/**
 * De "Mijn Sleutel"-QR met aftelring en automatische rotatie.
 *
 * ## Waarom de QR op wit staat
 *
 * De rest van de app is diep smaragdgroen of koningsblauw. Een QR-code daarop
 * renderen is een leuk idee tot een goedkope scanner in een donkere portiek hem
 * niet leest. Streepjescodescanners verwachten donker-op-licht met hoog
 * contrast. Esthetiek verliest hier van "de klant staat in de regen".
 *
 * ## Waarom er vóór het verlopen ververst wordt
 *
 * De token leeft 60 seconden; we halen na 30 een nieuwe op. Dat venster vangt
 * netwerklatentie én klokdrift tussen telefoon en scanner. Wachten tot seconde
 * 59 betekent onvermijdelijk klanten die net te laat scannen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Alert, Button } from './ui';

interface KeyState {
  svg: string;
  expiresAt: number;
  rotateAfterSeconds: number;
  /**
   * De volledige levensduur van déze sleutel, in seconden.
   *
   * Afgeleid van `expiresAt` op het moment van ontvangst — niet gelijk aan
   * `rotateAfterSeconds`. De ring moet leeglopen richting het *verlopen*, niet
   * richting het verversen; die twee liggen 30 seconden uit elkaar.
   */
  totalSeconds: number;
}

export function QrKey({ storeId }: { storeId: string }) {
  const { t } = useI18n();
  const [key, setKey] = useState<KeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Voorkomt dat een trage respons van een vorige aanvraag een nieuwere sleutel
  // overschrijft. Zonder dit toont de app na een hikkende verbinding een QR die
  // de server al als achterhaald beschouwt.
  const requestId = useRef(0);

  const fetchKey = useCallback(async () => {
    const id = ++requestId.current;
    setError(null);

    try {
      const response = await api.accessToken(storeId);
      if (id !== requestId.current) return;

      const svg = await QRCode.toString(response.qrPayload, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#0a0a0a', light: '#ffffff' },
      });

      if (id !== requestId.current) return;

      const expiresAt = new Date(response.expiresAt).getTime();

      setKey({
        svg,
        expiresAt,
        rotateAfterSeconds: response.rotateAfterSeconds,
        totalSeconds: Math.max(1, Math.round((expiresAt - Date.now()) / 1000)),
      });
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(cause instanceof ApiError ? cause.message : t('key.error'));
    }
  }, [storeId, t]);

  useEffect(() => {
    void fetchKey();
  }, [fetchKey]);

  // Rotatie: haal een nieuwe sleutel ruim vóór de oude verloopt.
  useEffect(() => {
    if (!key) return;

    const timer = window.setTimeout(() => void fetchKey(), key.rotateAfterSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [key, fetchKey]);

  // De aftelling. Loopt op de wandklok, niet op een teller die je optelt —
  // anders loopt hij achter zodra de telefoon de tab laat slapen.
  useEffect(() => {
    if (!key) return;

    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((key.expiresAt - Date.now()) / 1000)));
    tick();

    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [key]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variant="ghost" onClick={() => void fetchKey()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (!key) {
    return (
      <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-3xl border border-hairline bg-canvas-raised">
        <span className="text-sm text-ink-muted">{t('common.loading')}</span>
      </div>
    );
  }

  const progress = Math.min(1, Math.max(0, secondsLeft / key.totalSeconds));
  const expired = secondsLeft <= 0;

  return (
    <div className="flex flex-col items-center gap-6">
      {/*
        De ring ligt óver het vierkant heen, niet erboven. De QR moet binnen de
        ingeschreven vierkant van de cirkel passen: 288 / √2 ≈ 203px.
      */}
      <div className="relative grid size-[288px] place-items-center">
        <CountdownRing progress={progress} />

        <div
          className={`relative size-[200px] overflow-hidden rounded-2xl bg-white p-3 transition-opacity duration-300 [&>svg]:size-full ${
            expired ? 'opacity-30' : 'opacity-100'
          }`}
          // De QR is een afbeelding voor de scanner, geen inhoud voor een
          // schermlezer. De instructie eronder draagt de betekenis.
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: key.svg }}
        />
      </div>

      <div className="text-center">
        <p className="text-sm text-ink">{t('key.instruction')}</p>
        <p aria-live="polite" className="mt-1.5 text-xs tabular-nums text-ink-muted">
          {expired ? t('key.refreshing') : t('key.refreshIn', { seconds: secondsLeft })}
        </p>
      </div>

      <p className="max-w-xs text-center text-xs leading-relaxed text-ink-muted/70">
        {t('key.screenshotWarning', { seconds: key.rotateAfterSeconds })}
      </p>
    </div>
  );
}

/** De ring die leegloopt naarmate de sleutel verstrijkt. */
function CountdownRing({ progress }: { progress: number }) {
  const size = 288;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 250ms linear' }}
      />
    </svg>
  );
}
