"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-xl font-semibold">Something went wrong</p>
      <p className="text-sm text-ink-500">The error has been logged. Please try again.</p>
      <button className="btn" onClick={reset}>Retry</button>
    </main>
  );
}
