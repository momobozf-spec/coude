import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// Alleen voor lokale preview. In productie: statische host met de headers uit `_headers`.
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml', woff2: 'font/woff2' };
const allowed = ['index.html', 'privacy.html', 'juridisch.html', 'styles.css', 'config.js', 'contact.js', 'app.js', 'legal.js', 'favicon.svg',
  'fonts/dm-sans-latin-wght-normal.woff2', 'fonts/dm-sans-latin-ext-wght-normal.woff2', 'fonts/manrope-latin-wght-normal.woff2', 'fonts/manrope-latin-ext-wght-normal.woff2'];
const files = Object.fromEntries(allowed.map(name => ['/' + name, name]));
files['/'] = 'index.html';
const port = Number(process.env.PORT || 3015);
http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); return res.end('Niet gevonden'); }
  try {
    const body = await readFile(fileURLToPath(new URL(file, import.meta.url)));
    const type = types[file.split('.').pop()];
    res.writeHead(200, { 'Content-Type': type.startsWith('font/') ? type : `${type}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Pagina tijdelijk niet beschikbaar'); }
}).listen(port, '127.0.0.1', () => console.log(`Marhaba: http://localhost:${port}`));
