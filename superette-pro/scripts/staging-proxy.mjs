/**
 * Minimale HTTPS-reverse-proxy voor een lokale staging-opstelling, zonder
 * extra afhankelijkheden. Speelt de rol van Caddy/nginx uit docs/DEPLOYMENT.md:
 *
 *   https://localhost:8443/api/*  →  http://127.0.0.1:4000  (API)
 *   https://localhost:8443/*      →  http://127.0.0.1:3001  (app)
 *
 * Zet TLS af, stuurt X-Forwarded-For/-Proto/-Host door (de API vertrouwt één
 * hop via TRUST_PROXY=1) en begrenst de body op 128 kB. Niet voor productie;
 * daar hoort een echte proxy met certificaatbeheer.
 *
 *   TLS_CERT=… TLS_KEY=… node scripts/staging-proxy.mjs
 */
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const PORT = Number(process.env.PROXY_PORT ?? 8443);
const API = new URL(process.env.API_UPSTREAM ?? 'http://127.0.0.1:4000');
const WEB = new URL(process.env.WEB_UPSTREAM ?? 'http://127.0.0.1:3001');
const MAX_BODY = 128 * 1024;
const cert = readFileSync(process.env.TLS_CERT ?? 'localhost.crt');
const key = readFileSync(process.env.TLS_KEY ?? 'localhost.key');

const server = https.createServer({ cert, key, minVersion: 'TLSv1.2' }, (req, res) => {
  const upstream = req.url?.startsWith('/api/') ? API : WEB;
  const clientIp = req.socket.remoteAddress ?? '';
  const headers = { ...req.headers };
  delete headers['connection'];
  headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${clientIp}` : clientIp;
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-host'] = req.headers.host ?? `localhost:${PORT}`;
  headers['host'] = upstream.host;

  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > MAX_BODY) {
    res.writeHead(413, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Te groot voor de proxy.' }));
    req.resume();
    return;
  }

  const proxied = http.request(
    { hostname: upstream.hostname, port: upstream.port, method: req.method, path: req.url, headers, timeout: 30_000 },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  proxied.on('timeout', () => proxied.destroy(new Error('upstream time-out')));
  proxied.on('error', (error) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ statusCode: 502, code: 'BAD_GATEWAY', message: `Upstream niet bereikbaar: ${error.message}` }));
  });
  req.pipe(proxied);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`staging-proxy: https://localhost:${PORT}  →  /api → ${API.origin}, overige → ${WEB.origin}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
