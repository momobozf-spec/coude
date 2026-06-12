"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafdf8] px-4">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-red-100 p-8 shadow-sm text-center">
        <div className="text-4xl mb-4">{"\u26A0\uFE0F"}</div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-3">
          Er ging iets mis
        </h2>
        <p className="text-gray-600 mb-2">
          We konden Noor Tracker niet correct laden.
        </p>
        <p className="text-sm text-gray-400 mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="bg-emerald-700 text-white px-6 py-3 rounded-full font-bold hover:bg-emerald-800 transition-colors"
        >
          Probeer opnieuw
        </button>
      </div>
    </div>
  );
}
