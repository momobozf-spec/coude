// Robust parsing + validation of the model's JSON answer.
// The model is asked for bare JSON, but may wrap it in ```json fences or add text
// around it. We extract the first balanced JSON object, parse it, and normalise
// every field so the frontend never receives a malformed shape.

const SECTION_KEYS = ['experience', 'skills', 'education', 'formatting', 'impact']
const GRADES = ['A', 'B', 'C', 'D', 'F']

export class RoastParseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RoastParseError'
  }
}

// Returns the first balanced {...} substring, respecting strings and escapes.
export function extractJsonObject(raw) {
  if (typeof raw !== 'string') return null
  const start = raw.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

function clampScore(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}

function text(value, max = 1200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function gradeFor(score) {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

export function parseRoast(raw) {
  const candidate = extractJsonObject(raw)
  if (!candidate) throw new RoastParseError('No JSON object found in model output')

  let obj
  try {
    obj = JSON.parse(candidate)
  } catch {
    throw new RoastParseError('Model output is not valid JSON')
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new RoastParseError('Model output is not a JSON object')
  }

  const overallScore = clampScore(obj.overallScore)
  if (overallScore === null) throw new RoastParseError('overallScore missing or not a number')

  const rawGrade = typeof obj.grade === 'string' ? obj.grade.trim().toUpperCase().charAt(0) : ''
  const grade = GRADES.includes(rawGrade) ? rawGrade : gradeFor(overallScore)

  const sections = {}
  const srcSections = obj.sections && typeof obj.sections === 'object' ? obj.sections : {}
  for (const key of SECTION_KEYS) {
    const s = srcSections[key]
    const score = s && typeof s === 'object' ? clampScore(s.score) : null
    if (score === null) continue
    sections[key] = { score, comment: text(s.comment, 400) }
  }
  if (Object.keys(sections).length === 0) throw new RoastParseError('No valid sections in model output')

  const topFixes = Array.isArray(obj.topFixes)
    ? obj.topFixes.map((f) => text(f, 400)).filter(Boolean).slice(0, 3)
    : []

  const roast = text(obj.roast, 1500)
  if (!roast) throw new RoastParseError('roast missing in model output')

  return {
    overallScore,
    grade,
    sections,
    roast,
    topFixes,
    genuineCompliment: text(obj.genuineCompliment, 400),
    oneLiner: text(obj.oneLiner, 200),
  }
}
