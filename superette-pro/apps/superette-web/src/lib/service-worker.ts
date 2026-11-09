/**
 * Wanneer de service worker geregistreerd wordt: alleen in een productiebuild,
 * alleen als de browser het kan, en alleen op een veilige oorsprong (HTTPS of
 * localhost). In ontwikkeling nooit: een cachende worker maakt hot reload en
 * debuggen onbetrouwbaar.
 */
export function shouldRegisterServiceWorker(env: { nodeEnv: string | undefined; supported: boolean; protocol: string; hostname: string }): boolean {
  if (env.nodeEnv !== 'production' || !env.supported) return false;
  const local = env.hostname === 'localhost' || env.hostname === '127.0.0.1';
  return env.protocol === 'https:' || local;
}

/**
 * URL van de worker. De API-basis gaat mee als parameter, zodat de worker weet
 * welke publieke prijsroutes hij kort mag bewaren — en welke nooit.
 */
export function serviceWorkerUrl(apiBase: string): string {
  return `/sw.js?api=${encodeURIComponent(apiBase.replace(/\/+$/, ''))}`;
}
