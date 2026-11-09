import Link from "next/link";

// Public certificate sharing is not implemented yet. The previous version rendered a
// demo certificate ("Young Scholar") for ANY token, which looked like a real certificate.
export default function PublicCertificatePage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Certificate not available</h1>
        <p className="text-sm text-gray-500 mb-6">Public certificate links are not available yet.</p>
        <Link href="/" className="btn-primary">Noor Printables</Link>
      </div>
    </div>
  );
}
