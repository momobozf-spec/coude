import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

app.use(cors())
app.use(express.json({ limit: '1mb' }))
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
    let resumeText = req.body.text

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const data = await pdf(req.file.buffer)
        resumeText = data.text
      } else {
        resumeText = req.file.buffer.toString('utf-8')
      }
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text is too short. Paste more content or upload a file.' })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(resumeText) }]
    })

    const raw = message.content[0].text
    const result = JSON.parse(raw)
    res.json(result)
  } catch (err) {
    console.error('Roast error:', err)
    if (err.status === 401) {
      return res.status(401).json({ error: 'Invalid API key. Check your .env file.' })
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
