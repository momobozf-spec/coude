'use client';

/**
 * Alleen voor ontwikkeling zonder Mollie-sleutel.
 *
 * De `StubPaymentGateway` stuurt de klant hierheen in plaats van naar de hosted
 * checkout van Mollie. Deze pagina doet wat Mollie zou doen: de webhook aanroepen
 * en de klant terugsturen.
 *
 * Zodra `MOLLIE_API_KEY` gezet is, komt niemand hier ooit nog — de gateway geeft
 * dan een echte `checkoutUrl` van Mollie terug.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Alert, Button, Card, Wordmark } from '@/components/ui';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

function SimulationInner() {
  const params = useSearchParams();
  const router = useRouter();
  const paymentId = params.get('payment');

  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (state !== 'done') return;
    const timer = window.setTimeout(() => router.replace('/bonnen'), 1200);
    return () => window.clearTimeout(timer);
  }, [state, router]);

  async function confirm() {
    if (!paymentId) return;
    setState('working');

    const response = await fetch(`${API_URL}/webhooks/mollie`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: paymentId }),
    }).catch(() => null);

    setState(response?.ok ? 'done' : 'error');
  }

  if (!paymentId) return <Alert>Geen betaling opgegeven.</Alert>;

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-accent">Simulatie</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl">Betaling bevestigen</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Er is geen Mollie-sleutel geconfigureerd, dus deze betaling wordt gesimuleerd. In productie sta je hier op de
          Bancontact- of Payconiq-pagina van Mollie.
        </p>
      </div>

      <p className="rounded-lg border border-hairline bg-canvas-sunken px-3 py-2 font-mono text-xs text-ink-muted">
        {paymentId}
      </p>

      {state === 'done' && <Alert tone="success">Betaald. Je kasbon staat klaar.</Alert>}
      {state === 'error' && <Alert>De webhook kon niet worden aangeroepen.</Alert>}

      <Button onClick={() => void confirm()} disabled={state === 'working' || state === 'done'}>
        {state === 'working' ? 'Bezig…' : 'Betaling simuleren'}
      </Button>
    </Card>
  );
}

export default function SimulationPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Wordmark className="text-2xl" />
      </div>
      <Suspense fallback={null}>
        <SimulationInner />
      </Suspense>
    </main>
  );
}
