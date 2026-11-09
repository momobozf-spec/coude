import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig, assertProductionReady } from './server/config.js'
import { createApp } from './server/app.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config = loadConfig()
try {
  assertProductionReady(config)
} catch (err) {
  console.error(`FATAL: ${err.message}`)
  process.exit(1)
}

if (!config.anthropicApiKey) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set — /api/roast will fail until it is configured.')
}

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey || 'missing-key', maxRetries: 2, timeout: 60_000 })

const app = createApp({
  config,
  anthropic,
  extractPdfText: async (buf) => (await pdf(buf)).text,
  staticDir: join(__dirname, 'dist'),
})

app.listen(config.port, () => {
  console.log(`Resume Roaster listening on port ${config.port} (model: ${config.model})`)
})
