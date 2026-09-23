const eur = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function formatPrice(value: number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined) return "—";
  if (currency !== "EUR") return `${value.toLocaleString("nl-BE")} ${currency}`;
  return eur.format(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(value: Date | string | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diffMs = now.getTime() - d.getTime();
  const abs = Math.abs(diffMs);
  const future = diffMs < 0;
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const months = Math.round(days / 30);
  let text: string;
  if (minutes < 1) text = "just now";
  else if (minutes < 60) text = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  else if (hours < 24) text = `${hours} hour${hours === 1 ? "" : "s"}`;
  else if (days < 60) text = `${days} day${days === 1 ? "" : "s"}`;
  else text = `${months} month${months === 1 ? "" : "s"}`;
  if (text === "just now") return text;
  return future ? `in ${text}` : `${text} ago`;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

export function monthsBetween(from: Date, to: Date): number {
  return Math.floor(daysBetween(from, to) / 30.44);
}

export function percent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
