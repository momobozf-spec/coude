import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold text-ink-300">404</p>
      <p className="text-ink-700">This page or record does not exist, or it belongs to another agency.</p>
      <Link href="/" className="btn">Back to Today&apos;s Opportunities</Link>
    </main>
  );
}
