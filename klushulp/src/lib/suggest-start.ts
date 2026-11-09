/** Voorgestelde start voor een voorstel: eerste dag van de gewenste periode (of morgen) om 9 u, als datetime-local-string. */
export function suggestedStartFor(dateFrom: string | null, now = new Date()): string {
  const base = dateFrom ? new Date(`${dateFrom}T09:00:00`) : new Date(now.getTime() + 24 * 3600 * 1000);
  if (!dateFrom) base.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}
