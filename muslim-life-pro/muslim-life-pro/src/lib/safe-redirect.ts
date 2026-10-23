/**
 * Post-login redirect target.
 *
 * `callbackUrl` comes from the query string, so anyone can craft a login link
 * that sends a freshly signed-in member to a look-alike site. Only same-site
 * paths are honoured: they must start with a single `/`, may not start with
 * `//` or `/\` (protocol-relative), and may not contain control characters.
 */
export function safeCallbackPath(value: string | null | undefined, fallback = '/app'): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    // Resolving against a dummy origin must keep the origin unchanged.
    const url = new URL(value, 'https://same.invalid')
    if (url.origin !== 'https://same.invalid') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
