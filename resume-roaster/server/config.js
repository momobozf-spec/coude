// Central configuration for the Resume Roaster API server.
// All tunables come from environment variables; see .env.example.

// Default model: verified against the Model type in @anthropic-ai/sdk 1.2.0
// (node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts) — the SDK's
// own examples use 'claude-sonnet-5-5'. Override with ANTHROPIC_MODEL.
export const DEFAULT_MODEL = 'claude-sonnet-5-5'

function int(value, fallback, { min = 0 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < min) {
    throw new Error(`Invalid numeric configuration value: "${value}"`)
  }
  return n
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function trustProxy(value) {
  if (value === undefined || value === '') return false
  if (value === 'true') return true
  if (value === 'false') return false
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : value
}

export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production'
  const devOrigins = ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173']

  return {
    isProduction,
    port: int(env.PORT, 3001, { min: 1 }),
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    model: (env.ANTHROPIC_MODEL || '').trim() || DEFAULT_MODEL,
    maxTokens: int(env.ANTHROPIC_MAX_TOKENS, 1500, { min: 256 }),
    // Origins allowed to call the API from a browser. The app's own origin is always
    // allowed (same-origin). In development the Vite dev server is allowed as well.
    allowedOrigins: list(env.ALLOWED_ORIGINS).concat(isProduction ? [] : devOrigins),
    // Express "trust proxy" — set to 1 behind exactly one reverse proxy (Render, Railway, Fly).
    trustProxy: trustProxy(env.TRUST_PROXY),
    rateLimitWindowMs: int(env.RATE_LIMIT_WINDOW_MINUTES, 60, { min: 1 }) * 60 * 1000,
    rateLimitMax: int(env.RATE_LIMIT_MAX, 5, { min: 1 }),
    dailyLimit: int(env.DAILY_ROAST_LIMIT, 200, { min: 1 }),
    maxUploadBytes: int(env.MAX_UPLOAD_MB, 5, { min: 1 }) * 1024 * 1024,
    maxResumeChars: int(env.MAX_RESUME_CHARS, 20000, { min: 500 }),
    minResumeChars: 50,
  }
}

// Refuse to boot in production with a missing or placeholder API key.
export function assertProductionReady(config) {
  if (!config.isProduction) return
  const key = config.anthropicApiKey
  if (!key || /^sk-ant-(xxx|your|change|placeholder)/i.test(key) || key.includes('...')) {
    throw new Error(
      'ANTHROPIC_API_KEY is missing or a placeholder. Refusing to start in production (NODE_ENV=production).',
    )
  }
}
