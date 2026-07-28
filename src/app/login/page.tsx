'use client';

import { useActionState } from 'react';
import { signIn } from './actions';
import Lotus from '@/components/Lotus';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <div className="mb-10 text-center">
        <Lotus className="mx-auto mb-4 w-14" />
        <p className="eyebrow">Marushika</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-heading">Clienteling</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your client book.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-gold"
          />
        </label>

        {state?.error && (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-12 rounded-xl bg-accent text-base font-semibold text-accent-fg transition-opacity disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
