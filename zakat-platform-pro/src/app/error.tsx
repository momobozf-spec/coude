'use client'

import { useEffect } from 'react'

/** Onverwachte fout in een pagina. Toont nooit technische details aan de gebruiker. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Er ging iets mis</h1>
      <p className="max-w-sm text-sm text-muted">
        Je gegevens zijn niet aangepast. Probeer het opnieuw; blijft het misgaan, laat het ons weten
        {error.digest ? ` met deze code: ${error.digest}` : ''}.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium"
      >
        Opnieuw proberen
      </button>
    </main>
  )
}
