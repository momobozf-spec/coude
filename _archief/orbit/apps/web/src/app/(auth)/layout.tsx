import Link from 'next/link';

/** Rustige, gecentreerde omlijsting voor de inlogschermen. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-ink-on-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <ellipse
              cx="12"
              cy="12"
              rx="9.5"
              ry="4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              transform="rotate(-28 12 12)"
            />
            <ellipse
              cx="12"
              cy="12"
              rx="9.5"
              ry="4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              opacity="0.5"
              transform="rotate(45 12 12)"
            />
          </svg>
        </span>
        <span className="text-xl font-semibold tracking-tight">Orbit</span>
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-line-subtle bg-surface p-6 shadow-md">
        {children}
      </div>

      <p className="mt-6 max-w-sm text-center text-xs text-ink-tertiary">
        Ideeën, taken en notities op één plek. Op je telefoon, tablet en laptop.
      </p>
    </div>
  );
}
