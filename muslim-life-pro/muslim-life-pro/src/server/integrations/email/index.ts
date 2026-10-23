import 'server-only'

import { logger } from '@/lib/logger'

/**
 * Transactional e-mail (password reset only).
 *
 * Resend over plain `fetch`, like the other integrations — no SDK. Without
 * `RESEND_API_KEY` the app runs, but cannot send: the reset page then tells the
 * member to contact support instead of pretending a mail is on its way.
 *
 * Note: Resend only delivers to arbitrary recipients from a VERIFIED domain.
 * With the shared `onboarding@resend.dev` sender it delivers to the Resend
 * account owner alone — fine for testing, useless for members.
 */

const TIMEOUT_MS = 10_000

export function emailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
}

/** Minimal HTML escaping for values interpolated into a mail body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

/** Send one mail. Returns false (never throws) so callers can degrade cleanly. */
export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    logger.warn('email.not_configured')
    return false
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: controller.signal,
    })
    if (!response.ok) {
      logger.error('email.send.failed', { status: response.status })
      return false
    }
    return true
  } catch (error) {
    logger.error('email.send.failed', { error })
    return false
  } finally {
    clearTimeout(timeout)
  }
}
