"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #faf9f6, #f0ebe3)" }}>
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">&#9888;&#65039;</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-6">
          We&apos;re sorry for the inconvenience. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary">Try Again</button>
          <Link href="/" className="btn-secondary">Go Home</Link>
        </div>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-6 text-xs text-red-400 font-mono text-left p-3 bg-red-50 rounded-lg">{error.message}</p>
        )}
      </div>
    </div>
  );
}
