import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'
import { loadConfig, assertProductionReady, DEFAULT_MODEL } from '../server/config.js'

const RESUME = 'Jane Doe — Senior Engineer. SECRET-MARKER-123. ' + 'Built things at Acme. '.repeat(10)

const GOOD_ANSWER = JSON.stringify({
  overallScore: 65,
  grade: 'C',
  sections: {
    experience: { score: 60, comment: 'x' },
    skills: { score: 70, comment: 'x' },
    education: { score: 60, comment: 'x' },
    formatting: { score: 70, comment: 'x' },
    impact: { score: 40, comment: 'x' },
  },
  roast: 'Roasted.',
  topFixes: ['1', '2', '3'],
  genuineCompliment: 'ok',
  oneLiner: 'fine',
})

function makeLogger() {
  const lines = []
  const push = (...a) => lines.push(a.map(String).join(' '))
  return { lines, error: push, info: push, warn: push, log: push }
}

function makeAnthropic(impl) {
  const calls = []
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params)
        return impl(params)
      },
    },
  }
}

async function withServer(overrides, fn, { anthropicImpl, env = {} } = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test', ...env }), ...overrides }
  const anthropic = makeAnthropic(anthropicImpl || (() => ({ content: [{ type: 'text', text: GOOD_ANSWER }] })))
  const logger = makeLogger()
  const app = createApp({
    config,
    anthropic,
    logger,
    extractPdfText: async () => RESUME,
  })
  const server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    await fn({ base, anthropic, logger })
  } finally {
    await new Promise((r) => server.close(r))
  }
}

const postText = (base, text, headers = {}) =>
  fetch(`${base}/api/roast`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ text }),
  })

describe('config', () => {
  test('production guard refuses missing API key', () => {
    assert.throws(() => assertProductionReady(loadConfig({ NODE_ENV: 'production' })), /ANTHROPIC_API_KEY/)
    assert.throws(
      () => assertProductionReady(loadConfig({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-ant-xxx' })),
      /placeholder/,
    )
    assert.doesNotThrow(() =>
      assertProductionReady(loadConfig({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-ant-api03-realish' })),
    )
    assert.doesNotThrow(() => assertProductionReady(loadConfig({ NODE_ENV: 'development' })))
  })

  test('model comes from env with a current default', () => {
    assert.equal(loadConfig({}).model, DEFAULT_MODEL)
    assert.equal(loadConfig({ ANTHROPIC_MODEL: 'claude-haiku-5-5' }).model, 'claude-haiku-5-5')
  })

  test('dev origins are not allowed in production', () => {
    assert.deepEqual(loadConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://a.be/' }).allowedOrigins, [
      'https://a.be',
    ])
  })
})

describe('/api/roast', () => {
  test('happy path returns validated roast and uses configured model', async () => {
    await withServer({ model: 'claude-test-model' }, async ({ base, anthropic }) => {
      const res = await postText(base, RESUME)
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.overallScore, 65)
      assert.equal(anthropic.calls[0].model, 'claude-test-model')
      assert.match(anthropic.calls[0].messages[0].content, /<resume>/)
    })
  })

  test('health endpoint', async () => {
    await withServer({}, async ({ base }) => {
      const res = await fetch(`${base}/api/health`)
      assert.equal(res.status, 200)
      assert.equal((await res.json()).status, 'ok')
    })
  })

  test('per-IP rate limit returns 429', async () => {
    await withServer({ rateLimitMax: 2 }, async ({ base, anthropic }) => {
      assert.equal((await postText(base, RESUME)).status, 200)
      assert.equal((await postText(base, RESUME)).status, 200)
      const third = await postText(base, RESUME)
      assert.equal(third.status, 429)
      assert.equal(anthropic.calls.length, 2)
    })
  })

  test('daily global limit returns 503 and stops model calls', async () => {
    await withServer({ dailyLimit: 1, rateLimitMax: 100 }, async ({ base, anthropic }) => {
      assert.equal((await postText(base, RESUME)).status, 200)
      assert.equal((await postText(base, RESUME)).status, 503)
      assert.equal(anthropic.calls.length, 1)
    })
  })

  test('daily slot is released when the upstream call fails', async () => {
    let fail = true
    await withServer(
      { dailyLimit: 1, rateLimitMax: 100 },
      async ({ base }) => {
        assert.equal((await postText(base, RESUME)).status, 502)
        fail = false
        assert.equal((await postText(base, RESUME)).status, 200)
      },
      {
        anthropicImpl: () => {
          if (fail) throw Object.assign(new Error('boom'), { status: 500 })
          return { content: [{ type: 'text', text: GOOD_ANSWER }] }
        },
      },
    )
  })

  test('foreign Origin is rejected with 403, allowed origin passes with CORS header', async () => {
    await withServer({ allowedOrigins: ['https://roaster.example'] }, async ({ base, anthropic }) => {
      const evil = await postText(base, RESUME, { origin: 'https://evil.example' })
      assert.equal(evil.status, 403)
      assert.equal(evil.headers.get('access-control-allow-origin'), null)
      const ok = await postText(base, RESUME, { origin: 'https://roaster.example' })
      assert.equal(ok.status, 200)
      assert.equal(ok.headers.get('access-control-allow-origin'), 'https://roaster.example')
      // same-origin (Origin == own host) is allowed
      const self = await postText(base, RESUME, { origin: base })
      assert.equal(self.status, 200)
      assert.equal(anthropic.calls.length, 2)
    })
  })

  test('upload larger than the limit is rejected with 413', async () => {
    await withServer({ maxUploadBytes: 1024 }, async ({ base, anthropic }) => {
      const fd = new FormData()
      fd.append('file', new Blob([Buffer.alloc(4096, 'a')], { type: 'text/plain' }), 'cv.txt')
      const res = await fetch(`${base}/api/roast`, { method: 'POST', body: fd })
      assert.equal(res.status, 413)
      assert.equal(anthropic.calls.length, 0)
    })
  })

  test('unsupported file type is rejected', async () => {
    await withServer({}, async ({ base }) => {
      const fd = new FormData()
      fd.append('file', new Blob([Buffer.from('MZ....')], { type: 'application/x-msdownload' }), 'cv.exe')
      const res = await fetch(`${base}/api/roast`, { method: 'POST', body: fd })
      assert.equal(res.status, 415)
    })
  })

  test('file named .pdf without PDF magic bytes is rejected', async () => {
    await withServer({}, async ({ base }) => {
      const fd = new FormData()
      fd.append('file', new Blob([Buffer.from('not a pdf at all')], { type: 'application/pdf' }), 'cv.pdf')
      const res = await fetch(`${base}/api/roast`, { method: 'POST', body: fd })
      assert.equal(res.status, 415)
    })
  })

  test('real PDF upload goes through PDF extraction', async () => {
    await withServer({}, async ({ base, anthropic }) => {
      const fd = new FormData()
      fd.append('file', new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' }), 'cv.pdf')
      const res = await fetch(`${base}/api/roast`, { method: 'POST', body: fd })
      assert.equal(res.status, 200)
      assert.match(anthropic.calls[0].messages[0].content, /SECRET-MARKER-123/)
    })
  })

  test('too long resume is rejected before calling the model', async () => {
    await withServer({ maxResumeChars: 600 }, async ({ base, anthropic }) => {
      const res = await postText(base, 'x'.repeat(601))
      assert.equal(res.status, 413)
      assert.equal(anthropic.calls.length, 0)
    })
  })

  test('too short resume returns 400', async () => {
    await withServer({}, async ({ base }) => {
      assert.equal((await postText(base, 'short')).status, 400)
    })
  })

  test('malformed model output gives 502, and resume content is never logged', async () => {
    await withServer(
      {},
      async ({ base, logger }) => {
        const res = await postText(base, RESUME)
        assert.equal(res.status, 502)
        assert.ok(logger.lines.length > 0)
        for (const line of logger.lines) {
          assert.ok(!line.includes('SECRET-MARKER-123'), 'resume content leaked into logs')
          assert.ok(!line.includes('Jane Doe'), 'resume content leaked into logs')
        }
      },
      { anthropicImpl: () => ({ content: [{ type: 'text', text: 'Jane Doe SECRET-MARKER-123 not json' }] }) },
    )
  })

  test('upstream error containing resume text is not logged', async () => {
    await withServer(
      {},
      async ({ base, logger }) => {
        assert.equal((await postText(base, RESUME)).status, 502)
        for (const line of logger.lines) assert.ok(!line.includes('SECRET-MARKER-123'))
      },
      {
        anthropicImpl: (p) => {
          throw Object.assign(new Error(`failed for ${p.messages[0].content}`), { status: 500 })
        },
      },
    )
  })
})
