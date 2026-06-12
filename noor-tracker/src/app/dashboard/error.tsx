"use client";

export default function DashboardError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-red-100 p-8 text-center">
      <div className="text-4xl mb-4">{"\u26A0\uFE0F"}</div>
      <h2 className="text-xl font-extrabold text-gray-900 mb-2">
        Dashboard tijdelijk niet beschikbaar
      </h2>
      <p className="text-gray-600 mb-6">
        Vernieuw de data en probeer het opnieuw.
      </p>
      <button
        onClick={reset}
        className="bg-emerald-700 text-white px-5 py-3 rounded-full font-bold hover:bg-emerald-800 transition-colors"
      >
        Opnieuw laden
      </button>
    </div>
  );
}
