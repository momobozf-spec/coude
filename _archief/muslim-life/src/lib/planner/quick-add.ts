import { addDays, dayOfWeek, type IsoDate } from '@/lib/dates'
import type { ClockTime } from '@/lib/planner/time'

/**
 * Deterministic quick-add parsing.
 *
 * "Bel boekhouder morgen om 10:00" → title "Bel boekhouder", tomorrow, 10:00.
 *
 * Deliberately rule-based rather than AI: it is instant, free, offline, testable
 * and predictable. A user typing the same phrase must get the same result every
 * time — which an LLM cannot promise. The `ParsedQuickAdd` shape is what a future
 * NLP layer would also return, so upgrading is a swap behind this function.
 *
 * Supports English and Dutch, because those are the two languages the first
 * markets actually type in.
 */

export interface ParsedQuickAdd {
  title: string
  scheduledDate: IsoDate | null
  scheduledTime: ClockTime | null
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  /** Which fragments were consumed — used to show the user what we understood. */
  matched: string[]
}

interface DayWordRule {
  words: string[]
  /** Days from today, or a target weekday (0 = Sunday). */
  offset?: number
  weekday?: number
}

const DAY_WORDS: DayWordRule[] = [
  { words: ['today', 'vandaag'], offset: 0 },
  { words: ['tomorrow', 'morgen'], offset: 1 },
  { words: ['overmorgen', 'day after tomorrow'], offset: 2 },
  { words: ['sunday', 'zondag'], weekday: 0 },
  { words: ['monday', 'maandag'], weekday: 1 },
  { words: ['tuesday', 'dinsdag'], weekday: 2 },
  { words: ['wednesday', 'woensdag'], weekday: 3 },
  { words: ['thursday', 'donderdag'], weekday: 4 },
  { words: ['friday', 'vrijdag'], weekday: 5 },
  { words: ['saturday', 'zaterdag'], weekday: 6 },
]

/** Words that introduce a time and should be stripped along with it. */
const TIME_PREPOSITIONS = ['om', 'at', 'around', 'rond']

const HIGH_PRIORITY_TOKENS = ['!!', '!high', '!belangrijk']
const LOW_PRIORITY_TOKENS = ['!low', '!laag']

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The next occurrence of `weekday`, never today (matching how people speak). */
function nextWeekday(today: IsoDate, weekday: number): IsoDate {
  const current = dayOfWeek(today)
  const delta = (weekday - current + 7) % 7
  return addDays(today, delta === 0 ? 7 : delta)
}

/**
 * @param input   Raw text the user typed.
 * @param today   The user's local calendar day — passed in, never derived from
 *                the server clock, so "tomorrow" is tomorrow where they are.
 */
export function parseQuickAdd(input: string, today: IsoDate): ParsedQuickAdd {
  let working = ` ${input.trim()} `
  const matched: string[] = []

  let priority: ParsedQuickAdd['priority'] = 'NORMAL'
  let scheduledDate: IsoDate | null = null
  let scheduledTime: ClockTime | null = null

  // ── Priority tokens ───────────────────────────────────────────────────────
  for (const token of HIGH_PRIORITY_TOKENS) {
    const pattern = new RegExp(`\\s${escapeRegExp(token)}(?=\\s)`, 'i')
    if (pattern.test(working)) {
      priority = 'HIGH'
      working = working.replace(pattern, ' ')
      matched.push(token)
      break
    }
  }
  if (priority === 'NORMAL') {
    for (const token of LOW_PRIORITY_TOKENS) {
      const pattern = new RegExp(`\\s${escapeRegExp(token)}(?=\\s)`, 'i')
      if (pattern.test(working)) {
        priority = 'LOW'
        working = working.replace(pattern, ' ')
        matched.push(token)
        break
      }
    }
  }

  // ── Explicit date: 2026-08-14, 14/08, 14-08 ───────────────────────────────
  const isoMatch = /\s(\d{4}-\d{2}-\d{2})(?=\s)/.exec(working)
  if (isoMatch?.[1]) {
    scheduledDate = isoMatch[1]
    working = working.replace(isoMatch[0], ' ')
    matched.push(isoMatch[1])
  }

  if (!scheduledDate) {
    // Day-first, as written across Europe.
    const dmMatch = /\s(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?(?=\s)/.exec(working)
    if (dmMatch?.[1] && dmMatch[2]) {
      const day = Number(dmMatch[1])
      const month = Number(dmMatch[2])
      const year = dmMatch[3] ? Number(dmMatch[3]) : Number(today.slice(0, 4))

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        // Guard against 31 February and friends.
        if (!Number.isNaN(Date.parse(`${candidate}T00:00:00.000Z`))) {
          const parsed = new Date(`${candidate}T00:00:00.000Z`)
          if (parsed.getUTCDate() === day && parsed.getUTCMonth() + 1 === month) {
            scheduledDate = candidate
            working = working.replace(dmMatch[0], ' ')
            matched.push(dmMatch[0].trim())
          }
        }
      }
    }
  }

  // ── Relative and weekday words ────────────────────────────────────────────
  if (!scheduledDate) {
    for (const rule of DAY_WORDS) {
      const hit = rule.words.find((word) =>
        new RegExp(`\\s${escapeRegExp(word)}(?=\\s)`, 'i').test(working),
      )
      if (!hit) continue

      scheduledDate =
        rule.offset !== undefined ? addDays(today, rule.offset) : nextWeekday(today, rule.weekday!)

      working = working.replace(new RegExp(`\\s${escapeRegExp(hit)}(?=\\s)`, 'i'), ' ')
      matched.push(hit)
      break
    }
  }

  // ── Time: 10:00, 10.00, 10u30, 10h, 9am, 5pm ──────────────────────────────
  const timePatterns: { pattern: RegExp; build: (m: RegExpExecArray) => ClockTime | null }[] = [
    {
      pattern: /\s(\d{1,2})[:.](\d{2})\s*(am|pm)?(?=\s)/i,
      build: (m) => buildTime(Number(m[1]), Number(m[2]), m[3]),
    },
    {
      pattern: /\s(\d{1,2})\s*(am|pm)(?=\s)/i,
      build: (m) => buildTime(Number(m[1]), 0, m[2]),
    },
    {
      // Dutch/Belgian shorthand: "10u", "10u30".
      pattern: /\s(\d{1,2})u(\d{2})?(?=\s)/i,
      build: (m) => buildTime(Number(m[1]), m[2] ? Number(m[2]) : 0, undefined),
    },
  ]

  for (const { pattern, build } of timePatterns) {
    const match = pattern.exec(working)
    if (!match) continue

    const time = build(match)
    if (!time) continue

    scheduledTime = time
    working = working.replace(match[0], ' ')
    matched.push(match[0].trim())
    break
  }

  // Strip a now-dangling preposition ("… om", "… at").
  if (scheduledTime) {
    for (const preposition of TIME_PREPOSITIONS) {
      working = working.replace(new RegExp(`\\s${escapeRegExp(preposition)}\\s*(?=\\s|$)`, 'i'), ' ')
    }
  }

  // A time with no date means today — that is what people mean.
  if (scheduledTime && !scheduledDate) scheduledDate = today

  const title = working.replace(/\s+/g, ' ').trim()

  return {
    // Never return an empty title: if parsing ate everything, keep the original.
    title: title.length > 0 ? title : input.trim(),
    scheduledDate,
    scheduledTime,
    priority,
    matched,
  }
}

function buildTime(hours: number, minutes: number, meridiem: string | undefined): ClockTime | null {
  let resolved = hours

  if (meridiem) {
    const lower = meridiem.toLowerCase()
    if (lower === 'pm' && hours < 12) resolved = hours + 12
    if (lower === 'am' && hours === 12) resolved = 0
  }

  if (resolved > 23 || minutes > 59) return null

  return `${String(resolved).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
