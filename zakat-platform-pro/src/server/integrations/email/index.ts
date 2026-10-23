import 'server-only'

import { serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import {
  NoEmailSender,
  ResendEmailSender,
  type EmailSender,
} from '@/server/integrations/email/core'

export type { EmailMessage, EmailResult, EmailSender } from '@/server/integrations/email/core'

let cached: EmailSender | null = null

export function getEmailSender(): EmailSender {
  if (cached) return cached
  const env = serverEnv()

  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error('EMAIL_PROVIDER=resend vereist RESEND_API_KEY en EMAIL_FROM.')
    }
    cached = new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM)
    return cached
  }

  // Alleen buiten productie: het bericht (met eventuele herstellink) naar de log.
  cached = new NoEmailSender(
    env.NODE_ENV === 'production'
      ? undefined
      : (message) =>
          logger.info('email.not_sent_dev_copy', {
            to: message.to,
            subject: message.subject,
            text: message.text,
          }),
  )
  return cached
}

export function emailConfigured(): boolean {
  return serverEnv().EMAIL_PROVIDER === 'resend'
}
