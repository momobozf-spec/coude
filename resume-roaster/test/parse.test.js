import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoast, extractJsonObject, RoastParseError } from '../server/parse.js'

const valid = {
  overallScore: 72,
  grade: 'C',
  sections: {
    experience: { score: 70, comment: 'ok' },
    skills: { score: 80, comment: 'good' },
    education: { score: 60, comment: 'meh' },
    formatting: { score: 75, comment: 'clean' },
    impact: { score: 50, comment: 'where are the numbers?' },
  },
  roast: 'This resume reads like a grocery list.',
  topFixes: ['a', 'b', 'c', 'd'],
  genuineCompliment: 'Nice font.',
  oneLiner: 'Solid but sleepy.',
}

test('parses bare JSON', () => {
  const r = parseRoast(JSON.stringify(valid))
  assert.equal(r.overallScore, 72)
  assert.equal(r.grade, 'C')
  assert.equal(r.topFixes.length, 3)
})

test('parses JSON wrapped in markdown fences and chatter', () => {
  const raw = 'Sure! Here you go:\n```json\n' + JSON.stringify(valid) + '\n```\nHope that helps {not json}'
  assert.equal(parseRoast(raw).sections.impact.score, 50)
})

test('handles braces inside strings', () => {
  const v = { ...valid, roast: 'Your {skills} section is a } mess {' }
  assert.equal(parseRoast('xx' + JSON.stringify(v)).roast, v.roast)
})

test('clamps scores and derives a grade when missing/invalid', () => {
  const r = parseRoast(JSON.stringify({ ...valid, overallScore: 140, grade: 'Z+' }))
  assert.equal(r.overallScore, 100)
  assert.equal(r.grade, 'A')
})

test('drops invalid sections, keeps valid ones', () => {
  const r = parseRoast(
    JSON.stringify({ ...valid, sections: { experience: { score: 'abc' }, skills: { score: '55', comment: 1 } } }),
  )
  assert.deepEqual(Object.keys(r.sections), ['skills'])
  assert.equal(r.sections.skills.comment, '')
})

test('throws RoastParseError on garbage', () => {
  assert.throws(() => parseRoast('no json here'), RoastParseError)
  assert.throws(() => parseRoast('{"overallScore": 5, '), RoastParseError)
  assert.throws(() => parseRoast('{"overallScore": "x"}'), RoastParseError)
  assert.throws(() => parseRoast(JSON.stringify({ ...valid, roast: '' })), RoastParseError)
})

test('extractJsonObject returns null for unbalanced input', () => {
  assert.equal(extractJsonObject('{"a": {'), null)
})
