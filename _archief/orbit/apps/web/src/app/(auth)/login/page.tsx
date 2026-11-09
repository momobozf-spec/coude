import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Inloggen' };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Welkom terug</h1>
      <p className="mb-5 text-sm text-ink-tertiary">Log in om verder te gaan.</p>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
