'use server'

import { headers } from 'next/headers'
import { AuthError } from 'next-auth'

import { signIn } from '@/server/auth'
import { registerUser } from '@/server/modules/account/account.service'
import { loginSchema, registerSchema } from '@/server/modules/account/account.schema'
import { enforce } from '@/server/services/rate-limit'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { logger } from '@/lib/logger'

/** Best-effort client IP for rate limiting. Falls back to a shared bucket. */
async function clientIp(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip') ?? 'unknown'
}

export async function registerAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    const parsed = registerSchema.safeParse({
      name: formData.get('name'),
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
    await enforce('auth.login', await clientIp())

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
