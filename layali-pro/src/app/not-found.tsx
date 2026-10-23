import Link from "next/link";

// Global 404. The root layout intentionally renders no <html>/<body> (the
// [locale] layout does), so this page provides its own document shell.
export default function NotFound() {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex items-center justify-center bg-[#faf6ef] text-[#2c2218]">
        <div className="text-center px-6 py-32">
          <p className="text-6xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#b9633e" }}>
            404
          </p>
          <h1 className="mt-4 text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Deze pagina is niet gevonden
          </h1>
          <p className="mt-3 text-sm text-[#7c6a59]">
            De pagina die je zoekt bestaat niet of is verplaatst.
          </p>
          <Link
            href="/nl"
            className="mt-8 inline-block rounded-full bg-[#b9633e] px-8 py-3 text-sm font-medium text-white hover:opacity-90 transition"
          >
            Terug naar home
          </Link>
        </div>
      </body>
    </html>
  );
}
