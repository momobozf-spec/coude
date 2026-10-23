import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="text-xl font-semibold">Deze pagina bestaat niet</h1>
      <p className="max-w-sm text-sm text-muted">De link klopt niet, of het item is verwijderd.</p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        Naar de startpagina
      </Link>
    </main>
  )
}
