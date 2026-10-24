'use client';

/**
 * Webversie van de fysieke deurscanner. **Alleen voor ontwikkeling en demo's.**
 *
 * ## Waarom dit bestaat
 *
 * De klant-app kan de deur niet openen — dat is het hele beveiligingsmodel. De
 * telefoon toont een ondertekende claim; het kastje aan de muur wisselt die in
 * bij `/api/v1/gate/unlock` met zijn eigen apparaatsleutel.
 *
 * Zonder dat kastje kun je de app niet uitproberen: geen deur, geen winkelmandje,
 * niets te scannen. Deze pagina spéélt het kastje.
 *
 * ## Waarom dit nooit in productie mag
 *
 * De apparaatsleutel staat hier in de browserbundel. `NEXT_PUBLIC_*` is per
 * definitie publiek — wie de pagina opvraagt, heeft de sleutel. Op een echte
 * scanner staat die sleutel in een beveiligd element, niet in JavaScript.
 *
 * Daarom: deze route bestaat alleen als `NEXT_PUBLIC_ENABLE_DEV_SCANNER=true`.
 * Staat de vlag uit, dan geeft Next een 404 — de pagina bestaat dan niet, en de
 * sleutel zit niet in de bundel van de andere pagina's.
 */
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Wordmark } from '@/components/ui';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';
const ENABLED = process.env['NEXT_PUBLIC_ENABLE_DEV_SCANNER'] === 'true';
const DEVICE_KEY = process.env['NEXT_PUBLIC_DEV_DEVICE_KEY'] ?? '';
const DEVICE_ID = 'web-scanner-simulator';

interface Attempt {
  granted: boolean;
  result: string;
  message: string;
  basketId: string | null;
  at: string;
}

export default function DoorSimulatorPage() {
  if (!ENABLED) notFound();

  const [session, setSession] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastQr, setLastQr] = useState<string | null>(null);

  useEffect(() => {
    // De scanner leest normaal het scherm van de klant. Hier lenen we zijn sessie
    // uit dezelfde browser — dat is het enige onrealistische aan deze pagina.
    setSession(window.localStorage.getItem('jj.session'));
    setStoreId(window.localStorage.getItem('jj.store'));
  }, []);

  function record(attempt: Omit<Attempt, 'at'>) {
    setAttempts((previous) => [{ ...attempt, at: new Date().toLocaleTimeString('nl-BE') }, ...previous].slice(0, 8));
  }

  /** Haalt een verse sleutel op namens de klant en biedt hem aan de gate aan. */
  async function scanCustomerKey(reuseLast = false) {
    if (!session || !storeId) return;
    setBusy(true);

    try {
      let qrPayload = lastQr;

      if (!reuseLast || !qrPayload) {
        const keyResponse = await fetch(`${API_URL}/access/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
          body: JSON.stringify({ storeId }),
        });

        if (!keyResponse.ok) {
          const body = await keyResponse.json().catch(() => ({}));
          record({ granted: false, result: `HTTP ${keyResponse.status}`, message: body.message ?? 'Sleutel weigeren', basketId: null });
          return;
        }

        qrPayload = (await keyResponse.json()).qrPayload;
        setLastQr(qrPayload);
      }

      const unlockResponse = await fetch(`${API_URL}/gate/unlock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-key': DEVICE_KEY },
        body: JSON.stringify({ qrPayload, storeId, deviceId: DEVICE_ID }),
      });

      if (unlockResponse.status === 401) {
        record({ granted: false, result: 'DEVICE_UNAUTHORIZED', message: 'Apparaatsleutel klopt niet', basketId: null });
        return;
      }

      const result = await unlockResponse.json();
      record({ granted: result.granted, result: result.result, message: result.displayMessage.nl, basketId: result.basketId });
    } finally {
      setBusy(false);
    }
  }

  /** Speelt de uitgangssensor: verlaagt de bezetting en sluit een verlaten mandje af. */
  async function registerExit() {
    const basketId = attempts.find((attempt) => attempt.basketId)?.basketId;
    if (!storeId || !basketId) return;

    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/gate/exit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-key': DEVICE_KEY },
        body: JSON.stringify({ storeId, deviceId: DEVICE_ID, basketId }),
      });

      record({
        granted: response.status === 204,
        result: response.status === 204 ? 'EXIT_OK' : `HTTP ${response.status}`,
        message: response.status === 204 ? 'Klant heeft de winkel verlaten' : 'Uitgang mislukt',
        basketId: null,
      });
    } finally {
      setBusy(false);
    }
  }

  const notLoggedIn = !session || !storeId;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-accent">Alleen voor ontwikkeling</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">Deurscanner</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Dit is het kastje aan de muur. In het echt leest het de QR-code van het scherm van de klant en wisselt die in
          bij de gate. Hier doen we hetzelfde, met de sessie uit deze browser.
        </p>
      </header>

      {notLoggedIn ? (
        <Alert>
          Log eerst in bij de app en kies een winkel. Deze pagina heeft een klantsessie nodig om na te bootsen.
        </Alert>
      ) : (
        <div className="space-y-4">
          <Card className="space-y-3">
            <Button onClick={() => void scanCustomerKey(false)} disabled={busy}>
              {busy ? 'Bezig…' : 'Klant houdt sleutel voor de scanner'}
            </Button>

            {/*
              Dezelfde QR nogmaals aanbieden. Dit is het replay-scenario: de token
              is eenmalig, dus de tweede poging hoort DENIED_REPLAY te geven.
            */}
            <Button variant="ghost" onClick={() => void scanCustomerKey(true)} disabled={busy || !lastQr}>
              Scan dezelfde code nogmaals (replay-test)
            </Button>

            <Button variant="ghost" onClick={() => void registerExit()} disabled={busy || !attempts.some((a) => a.basketId)}>
              Klant verlaat de winkel
            </Button>
          </Card>

          {attempts.length > 0 && (
            <Card className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-ink-muted">Logboek</h2>

              <ul className="space-y-2.5">
                {attempts.map((attempt, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${attempt.granted ? 'bg-success' : 'bg-danger'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs text-ink">{attempt.result}</span>
                      <span className="block text-xs text-ink-muted">{attempt.message}</span>
                    </span>
                    <time className="shrink-0 text-xs tabular-nums text-ink-muted/60">{attempt.at}</time>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <p className="text-xs leading-relaxed text-ink-muted/70">
            Ging de deur open, dan staat er een winkelmandje klaar. Ga terug naar de app en tik op “Scannen”.
          </p>

          <Button variant="ghost" onClick={() => (window.location.href = '/scannen')}>
            Terug naar de app
          </Button>
        </div>
      )}

      <footer className="mt-10 rounded-xl border border-danger/30 bg-danger/5 p-4">
        <p className="text-xs leading-relaxed text-ink-muted">
          <strong className="text-danger">Waarschuwing.</strong> De apparaatsleutel staat op deze pagina in de
          browserbundel. <code className="text-ink">NEXT_PUBLIC_*</code> wordt bij de build ingebakken, dus de vlag
          uitzetten is niet genoeg: laat vóór elke deploy óók{' '}
          <code className="text-ink">NEXT_PUBLIC_DEV_DEVICE_KEY</code> leeg. Dan bakt Next een lege string in en is er
          niets te lekken.
        </p>
      </footer>

      <div className="mt-8 text-center opacity-40">
        <Wordmark className="text-sm" />
      </div>
    </main>
  );
}
