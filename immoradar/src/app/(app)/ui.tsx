/** Shared server-component UI primitives for the app. */

export function fmtEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `€${value.toLocaleString("nl-BE")}`;
}

export function fmtCity(city: string | null | undefined): string {
  if (!city) return "Unknown";
  return city
    .split(/([ -])/)
    .map((part) => (part === " " || part === "-" ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

export function fmtDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "—";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30.44);
  return `${months} months ago`;
}

export function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    NEW_FSBO: "New FSBO",
    STALE_FSBO: "Stale FSBO",
    PRIVATE_PRICE_DROP: "Price Drop",
    PRIVATE_MULTIPLE_PRICE_DROP: "Multiple Price Drops",
    PRIVATE_RELIST: "Relisted",
    AGENCY_TO_PRIVATE: "Agency → Private",
    DORMANT_VALUATION_LEAD: "Dormant Valuation Lead",
    FORMER_SELLER_PROSPECT: "Former Seller Prospect",
    FORMER_CLIENT: "Former Client",
    OLD_BUYER: "Previous Buyer",
    LOST_MANDATE: "Lost Mandate",
    UNCONTACTED_LEAD: "Uncontacted Lead",
    CRM_MARKET_MATCH: "CRM + Market Match",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

export function statusLabel(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  const color =
    score >= 90
      ? "bg-red-600 text-white"
      : score >= 75
        ? "bg-orange-500 text-white"
        : score >= 60
          ? "bg-amber-400 text-slate-900"
          : "bg-slate-300 text-slate-700";
  const cls = size === "lg" ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm";
  return (
    <div
      className={`flex ${cls} shrink-0 items-center justify-center rounded-xl font-bold ${color}`}
      title={`Opportunity score ${score}/100`}
    >
      {score}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "indigo" | "red" | "green" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-400">{hint}</p> : null}
    </div>
  );
}
