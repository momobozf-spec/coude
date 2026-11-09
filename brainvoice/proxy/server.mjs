// BrainVoice AI proxy – keeps the Anthropic API key off the phone.
//
// The app sends exactly the Messages API request shape to POST /v1/messages with
// `Authorization: Bearer <device token>`. The proxy checks the token, enforces a model
// allow-list and output limits, forwards the request with the official SDK and returns
// the Message JSON unchanged (the app reads `content[].text`).
//
// Run:  ANTHROPIC_API_KEY=sk-ant-… PROXY_TOKENS=token1,token2 node server.mjs
import http from 'node:http';

import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT ?? 8787);
const TOKENS = new Set((process.env.PROXY_TOKENS ?? '').split(',').map((t) => t.trim()).filter(Boolean));
const ALLOWED_MODELS = new Set((process.env.ALLOWED_MODELS ?? 'claude-opus-5,claude-sonnet-5,claude-haiku-4-5').split(',').map((m) => m.trim()));
const MAX_TOKENS_CAP = Number(process.env.MAX_TOKENS_CAP ?? 4096);
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required');
  process.exit(1);
}
if (TOKENS.size === 0) {
  console.error('PROXY_TOKENS is required (comma-separated device tokens)');
  process.exit(1);
}

const client = new Anthropic();
const buckets = new Map();

function allow(token) {
  const now = Date.now();
  const bucket = buckets.get(token) ?? { windowStart: now, count: 0 };
  if (now - bucket.windowStart > 60_000) {
    bucket.windowStart = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  buckets.set(token, bucket);
  return bucket.count <= RATE_LIMIT_PER_MINUTE;
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/v1/messages') return json(res, 404, { error: { message: 'not found' } });

  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !TOKENS.has(token)) return json(res, 401, { error: { message: 'invalid token' } });
  if (!allow(token)) return json(res, 429, { error: { message: 'rate limited' } });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return json(res, 400, { error: { message: e instanceof Error ? e.message : 'invalid json' } });
  }
  if (!ALLOWED_MODELS.has(body.model)) return json(res, 400, { error: { message: `model not allowed: ${body.model}` } });
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json(res, 400, { error: { message: 'messages required' } });

  try {
    const message = await client.messages.create({
      model: body.model,
      max_tokens: Math.min(Number(body.max_tokens ?? 1024), MAX_TOKENS_CAP),
      system: typeof body.system === 'string' ? body.system : undefined,
      messages: body.messages,
      output_config: body.output_config,
    });
    return json(res, 200, message);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(res, 429, { error: { message: 'upstream rate limited' } });
    if (e instanceof Anthropic.AuthenticationError) return json(res, 500, { error: { message: 'proxy misconfigured' } });
    if (e instanceof Anthropic.APIError) return json(res, e.status ?? 502, { error: { message: e.message } });
    return json(res, 502, { error: { message: e instanceof Error ? e.message : 'upstream error' } });
  }
});

server.listen(PORT, () => console.log(`BrainVoice proxy listening on :${PORT}`));
