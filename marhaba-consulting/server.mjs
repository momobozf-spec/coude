import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
const port = Number(process.env.PORT || 3015);
http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); return res.end('Niet gevonden'); }
  try {
    const body = await readFile(fileURLToPath(new URL(file[0], import.meta.url)));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Pagina tijdelijk niet beschikbaar'); }
}).listen(port, '127.0.0.1', () => console.log(`Marhaba: http://localhost:${port}`));
