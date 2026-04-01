import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #faf9f6, #f0ebe3)" }}>
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">&#127769;</div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">404</h1>
        <h2 className="text-lg font-medium text-gray-600 mb-4">Page not found</h2>
        <p className="text-sm text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary">Go Home</Link>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
