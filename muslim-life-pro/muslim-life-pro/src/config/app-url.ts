/**
 * The public base URL of this deployment, read at RUNTIME.
 *
 * `NEXT_PUBLIC_*` variables are inlined into the bundle at build time. On a host
 * that builds the image before the URL is known (Render, Docker), that bakes in
 * `http://localhost:3000`. Server code therefore reads `APP_URL` from the live
 * environment; the bracket access keeps the bundler from inlining it.
 */
export function appUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env['APP_URL'] || env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000'
  try {
    return new URL(raw).origin
  } catch {
    return 'http://localhost:3000'
  }
}
