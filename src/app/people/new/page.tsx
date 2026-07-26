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
      <header className="flex items-center justify-between py-4">
        <h1 className="text-xl font-semibold tracking-tight">New contact</h1>
        <Link href="/people" className="text-sm text-neutral-500">
          Cancel
        </Link>
      </header>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            name="full_name"
            autoComplete="name"
            dir="auto"
            className="h-12 rounded-xl border border-neutral-300 px-4 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Phone <span className="text-red-500">*</span>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="050 123 4567"
            dir="ltr"
            className="h-12 rounded-xl border border-neutral-300 px-4 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Source</span>
          <input type="hidden" name="source" value={source} />
          <div className="grid grid-cols-3 gap-2">
            {QUICK_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`h-11 rounded-xl border text-sm ${
                  source === s
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                }`}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Note (optional)</span>
          <textarea
            name="note"
            rows={3}
            dir="auto"
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-12 rounded-xl bg-neutral-900 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? 'Saving…' : 'Save contact'}
        </button>
      </form>
    </main>
  );
}
