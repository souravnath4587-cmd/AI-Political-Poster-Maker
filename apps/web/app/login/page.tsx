import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'লগইন — পোস্টার মেকার' };

export default function LoginPage() {
  return (
    // LoginForm reads ?next= with useSearchParams, which needs a Suspense boundary.
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
