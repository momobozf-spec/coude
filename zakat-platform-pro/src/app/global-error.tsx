'use client'

/** Laatste vangnet als zelfs de root-layout faalt. Geen afhankelijkheden, eigen <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="nl">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem' }}>Er ging iets mis</h1>
        <p style={{ color: '#555' }}>Herlaad de pagina of probeer het later opnieuw.</p>
        <button type="button" onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Opnieuw proberen
        </button>
      </body>
    </html>
  )
}
