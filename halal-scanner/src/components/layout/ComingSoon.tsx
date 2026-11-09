import Link from "next/link";

/**
 * Nette lege staat voor secties die in een latere fase gebouwd worden.
 *
 * Bestaat zodat de navigatie nu al klopt zonder dat er nepdata of half werkende
 * knoppen op het scherm komen. Een gebruiker die hier belandt weet wat er komt
 * en hoe hij terugkomt bij wat wél werkt.
 */
export function ComingSoon({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </header>

      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm text-[var(--muted)]">{body}</p>
      </div>

      <Link
        href="/scan"
        className="flex min-h-12 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)]"
      >
        Naar de scanner
      </Link>
    </div>
  );
}
