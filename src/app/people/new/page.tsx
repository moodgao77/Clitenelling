'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { addPerson } from '@/app/people/actions';
import { SOURCE_LABEL, type Source } from '@/lib/types';

const QUICK_SOURCES: Source[] = ['whatsapp', 'instagram', 'walk_in'];

export default function NewPersonPage() {
  const [state, formAction, pending] = useActionState(addPerson, undefined);
  const [source, setSource] = useState<Source>('walk_in');

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-8">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-xl font-semibold tracking-tight text-heading">New contact</h1>
        <Link href="/people" className="text-sm text-muted underline-offset-4 hover:underline">
          Cancel
        </Link>
      </header>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            name="full_name"
            autoComplete="name"
            dir="auto"
            className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Phone <span className="text-danger">*</span>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="050 123 4567"
            dir="ltr"
            className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-gold"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Source</span>
          <input type="hidden" name="source" value={source} />
          <div className="grid grid-cols-3 gap-2">
            {QUICK_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`h-11 rounded-xl border text-sm transition-colors ${
                  source === s
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-line text-muted hover:border-line-strong'
                }`}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Note (optional)</span>
          <textarea
            name="note"
            rows={3}
            dir="auto"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-colors focus:border-gold"
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
          className="mt-1 h-12 rounded-xl bg-accent text-base font-semibold text-accent-fg transition-opacity disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save contact'}
        </button>
      </form>
    </main>
  );
}
