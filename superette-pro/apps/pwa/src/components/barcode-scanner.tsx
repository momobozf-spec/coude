'use client';

/**
 * Self-scanning met de camera van de telefoon.
 *
 * ## Waarom `BarcodeDetector` en niet een JS-decoder
 *
 * `BarcodeDetector` is een browser-API die de decoder van het besturingssysteem
 * gebruikt: snel, zuinig met batterij, en goed onder slecht licht. De prijs is
 * dekking — Chrome en Edge op Android en desktop hebben hem, Safari niet.
 *
 * Daarom is handmatige invoer geen bijzaak maar een volwaardig pad. Wie de code
 * intikt, komt langs exact dezelfde controlecijfer-validatie op de server.
 *
 * ## De ontdubbeling
 *
 * Een camera levert 30 frames per seconde. Zonder rem legt één scan van een pak
 * dadels er dertig in het mandje. We negeren dezelfde barcode gedurende twee
 * seconden na een geslaagde scan.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Alert, Button, Field } from './ui';

// De W3C Shape Detection API zit (nog) niet in de TypeScript DOM-lib.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  // eslint-disable-next-line no-var
  var BarcodeDetector: (new (options?: { formats: string[] }) => BarcodeDetectorLike) | undefined;
}

const DEDUPE_WINDOW_MS = 2_000;

type CameraState = 'starting' | 'running' | 'unsupported' | 'denied';

export function BarcodeScanner({ onScan, busy }: { onScan: (barcode: string) => void; busy: boolean }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [manual, setManual] = useState('');

  const lastScan = useRef<{ barcode: string; at: number } | null>(null);

  const handleDetection = useCallback(
    (barcode: string) => {
      const now = Date.now();
      const previous = lastScan.current;

      if (previous && previous.barcode === barcode && now - previous.at < DEDUPE_WINDOW_MS) return;

      lastScan.current = { barcode, at: now };
      onScan(barcode);
    },
    [onScan],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!globalThis.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }

    const detector = new globalThis.BarcodeDetector({ formats: ['ean_13', 'ean_8'] });
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    const scanFrame = async () => {
      const video = videoRef.current;

      if (!stopped && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const [found] = await detector.detect(video);
          if (found) handleDetection(found.rawValue);
        } catch {
          // Een enkel frame dat de decoder niet aankan is normaal. Doorgaan.
        }
      }

      if (!stopped) frame = requestAnimationFrame(() => void scanFrame());
    };

    navigator.mediaDevices
      // `environment`: de achtercamera. Zonder dit richt een telefoon de
      // selfiecamera op het plafond.
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (mediaStream) => {
        if (stopped) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = mediaStream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = mediaStream;
        await video.play();
        setState('running');
        frame = requestAnimationFrame(() => void scanFrame());
      })
      .catch(() => setState('denied'));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      // De camera moet uit zodra dit scherm weg is. Anders blijft het lampje
      // branden en de batterij leeglopen.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [handleDetection]);

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = manual.trim();
    if (cleaned) {
      onScan(cleaned);
      setManual('');
    }
  };

  return (
    <div className="space-y-5">
      {state === 'running' || state === 'starting' ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline bg-canvas-sunken">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />

          {/* Het richtvenster. Puur visueel — de detector kijkt naar het hele frame. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-28 w-64 rounded-lg border-2 border-accent/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>

          {state === 'starting' && (
            <div className="absolute inset-0 grid place-items-center bg-canvas/80">
              <span className="text-sm text-ink-muted">{t('common.loading')}</span>
            </div>
          )}
        </div>
      ) : (
        <Alert>{state === 'denied' ? t('scan.denied') : t('scan.unsupported')}</Alert>
      )}

      {state === 'running' && <p className="text-center text-sm text-ink-muted">{t('scan.instruction')}</p>}

      <form onSubmit={submitManual} className="space-y-3">
        <Field
          label={t('scan.manual')}
          name="barcode"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{8}|\d{13}"
          placeholder="5412345000013"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
        />
        <Button type="submit" variant="ghost" disabled={busy || manual.trim().length === 0}>
          {t('scan.manual.submit')}
        </Button>
      </form>
    </div>
  );
}
