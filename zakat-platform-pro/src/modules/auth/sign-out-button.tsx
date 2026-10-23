'use client'

import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui'

export function SignOutButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
      Uitloggen
    </Button>
  )
}
