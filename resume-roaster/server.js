import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } })

// Every roast costs API credit, so the endpoint is same-origin only (no CORS),
// capped per IP and per day, and the resume text is truncated.
const MAX_RESUME_CHARS = 15000
const PER_IP_LIMIT = Number(process.env.ROAST_PER_IP_PER_HOUR || 5)
const DAILY_LIMIT = Number(process.env.ROAST_DAILY_LIMIT || 200)
const hits = new Map()
let day = new Date().toISOString().slice(0, 10)
let dailyCount = 0

function allowRoast(ip) {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== day) { day = today; dailyCount = 0; hits.clear() }
  if (dailyCount >= DAILY_LIMIT) return false
  const hourAgo = Date.now() - 60 * 60 * 1000
  const recent = (hits.get(ip) || []).filter((t) => t > hourAgo)
  if (recent.length >= PER_IP_LIMIT) return false
  recent.push(Date.now())
  hits.set(ip, recent)
  dailyCount++
  return true
}

app.set('trust proxy', Number(process.env.TRUSTED_PROXY_HOPS || 1))
app.use(express.json({ limit: '64kb' }))
app.use(express.static(join(__dirname, 'dist')))

const anthropic = new Anthropic()

function buildPrompt(resumeText) {
  return `You are a brutally honest, witty career coach — a mix of Gordon Ramsay and a senior Google recruiter.

Analyze this resume and respond ONLY with valid JSON, no markdown, no backticks.

Resume:
"""
${resumeText}
"""

Return this exact JSON structure:
{
  "overallScore": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "sections": {
    "experience": { "score": <number 0-100>, "comment": "one sharp sentence" },
    "skills": { "score": <number 0-100>, "comment": "one sharp sentence" },
    "education": { "score": <number 0-100>, "comment": "one sharp sentence" },
    "formatting": { "score": <number 0-100>, "comment": "one sharp sentence" },
    "impact": { "score": <number 0-100>, "comment": "one sharp sentence" }
  },
  "roast": "3-4 sentence savage but helpful roast. Funny, brutal, true.",
  "topFixes": ["fix 1", "fix 2", "fix 3"],
  "genuineCompliment": "one honest positive thing",
  "oneLiner": "A punchy 1-sentence verdict under 15 words"
}`
}

app.post('/api/roast', upload.single('file'), async (req, res) => {
  try {
    if (!allowRoast(req.ip)) {
      return res.status(429).json({ error: 'Too many roasts right now. Try again later.' })
    }

    let resumeText = typeof req.body.text === 'string' ? req.body.text : ''

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const data = await pdf(req.file.buffer)
        resumeText = data.text
      } else if (req.file.mimetype.startsWith('text/')) {
        resumeText = req.file.buffer.toString('utf-8')
      } else {
        return res.status(400).json({ error: 'Upload a PDF or a plain-text file.' })
      }
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text is too short. Paste more content or upload a file.' })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(resumeText.slice(0, MAX_RESUME_CHARS)) }]
    })

    const raw = message.content[0].text
    let result
    try {
      result = JSON.parse(raw)
    } catch {
      return res.status(502).json({ error: 'The roast came back garbled. Try again.' })
    }
    res.json(result)
  } catch (err) {
    // Log the error type only, never the resume.
    console.error('Roast error:', err?.status || '', err?.name || 'Error')
    if (err.status === 401) {
      return res.status(503).json({ error: 'Roasting is unavailable right now.' })
    }
    res.status(500).json({ error: 'Failed to roast resume. Try again.' })
  }
})

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`🔥 Resume Roaster API running on http://localhost:${PORT}`))
