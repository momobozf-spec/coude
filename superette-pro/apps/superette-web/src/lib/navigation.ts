/** Alleen interne paden; voorkomt een open redirect via `?terug=`. */
export function safeReturnPath(value: string | null, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
