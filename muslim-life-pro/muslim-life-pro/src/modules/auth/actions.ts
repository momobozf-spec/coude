'use server'

import { headers } from 'next/headers'
import { AuthError } from 'next-auth'

import { signIn } from '@/server/auth'
import { requireActor } from '@/server/auth/actor'
import { registerUser } from '@/server/modules/account/account.service'
import { loginSchema, registerSchema } from '@/server/modules/account/account.schema'
import {
  changePassword,
  requestPasswordReset,
  resetPassword,
} from '@/server/modules/account/password.service'
import { clientIpFrom, trustedProxyHops } from '@/server/http/client-ip'
import { enforce } from '@/server/services/rate-limit'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { logger } from '@/lib/logger'

/** Client IP for rate limiting, read from the trusted proxy hop — never the spoofable left-most entry. */
async function clientIp(): Promise<string> {
  const headerList = await headers()
  return clientIpFrom(headerList.get('x-forwarded-for'), trustedProxyHops())
}

export async function registerAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    const parsed = registerSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      consent: formData.get('consent') === 'on',
    })

    if (!parsed.success) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Please check the form and try again.',
      }
    }

    await registerUser(parsed.data, await clientIp())

    // Sign the new user straight in — asking them to log in again right after
    // registering is pure friction. `redirect: false` so we can return a result
    // and let the client navigate.
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })

    return actionOk(null)
  } catch (error) {
    logger.error('auth.register.failed', { error })
    return actionError(error)
  }
}

export async function loginAction(formData: FormData): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues[0]?.message ?? 'Please check the form and try again.',
    }
  }

  try {
    const ip = await clientIp()
    // Per IP — skipped when the address is unknown, so a misconfigured proxy
    // setting cannot put every visitor into one shared bucket.
    if (ip !== 'unknown') await enforce('auth.login', ip)
    // Per account as well, so rotating IP addresses does not buy more guesses.
    await enforce('auth.login.account', parsed.data.email)

    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })

    return actionOk(null)
  } catch (error) {
    if (error instanceof AuthError) {
      // Never distinguish "no such user" from "wrong password" — that is an
      // account-enumeration vector.
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: "That email and password combination didn't work.",
      }
    }
    logger.error('auth.login.failed', { error })
    return actionError(error)
  }
}

/** Always answers the same, whether or not the address has an account. */
export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    await requestPasswordReset(String(formData.get('email') ?? ''), await clientIp())
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    await resetPassword(String(formData.get('token') ?? ''), String(formData.get('password') ?? ''))
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    await changePassword(
      actor,
      String(formData.get('currentPassword') ?? ''),
      String(formData.get('newPassword') ?? ''),
    )
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
