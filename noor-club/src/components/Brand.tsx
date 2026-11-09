import { Link } from "@/navigation";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-lg font-extrabold text-emerald-dark"
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald text-white"
        aria-hidden="true"
      >
        ن
      </span>
      Noor Club
    </Link>
  );
}
