import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Registreren' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Account aanmaken</h1>
      <p className="mb-5 text-sm text-ink-tertiary">
        Je krijgt meteen een eigen workspace met mappen en tags.
      </p>
      <Suspense fallback={null}>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}
