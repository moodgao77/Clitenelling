import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import StageStepper from '@/components/StageStepper';
import ActivityTimeline from '@/components/ActivityTimeline';
import OrderHistory from '@/components/OrderHistory';
import { assignToMeAction, saveNotesAction, addActivityAction } from './actions';
import { waLink, defaultMessage } from '@/lib/whatsapp';
import { SOURCE_LABEL, type Person, type Order, type Activity, type StageHistoryRow } from '@/lib/types';

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionProfile();
  const supabase = await createServerSupabase();

  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', id)
    .maybeSingle<Person>();
  if (!person) notFound();

  const [{ data: orders }, { data: activities }, { data: history }, { data: ownerRow }] =
    await Promise.all([
      supabase.from('orders').select('*').eq('person_id', id).order('ordered_at', { ascending: false }),
      supabase.from('activities').select('*').eq('person_id', id),
      supabase.from('stage_history').select('*').eq('person_id', id).order('changed_at', { ascending: false }),
      person.owner_id
        ? supabase.from('profiles').select('full_name').eq('id', person.owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const isMine = !!me && person.owner_id === me.id;
  const ownerLabel = !person.owner_id
    ? 'Unassigned'
    : isMine
      ? 'You'
      : (ownerRow as { full_name?: string } | null)?.full_name ?? 'Another associate';

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <Link href="/people" className="text-sm text-neutral-500">
          ← Clients
        </Link>
        <span className="text-xs text-neutral-400">{SOURCE_LABEL[person.source]}</span>
      </header>

      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight" dir="auto">
          {person.full_name || 'Unnamed'}
        </h1>
        <p className="mt-1 text-neutral-500" dir="ltr">
          {person.phone_e164}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-neutral-500">Owner: {ownerLabel}</span>
          {!person.owner_id && (
            <form action={assignToMeAction}>
              <input type="hidden" name="personId" value={person.id} />
              <button className="rounded-lg border border-neutral-900 px-2.5 py-1 text-xs font-medium dark:border-white">
                Assign to me
              </button>
            </form>
          )}
        </div>
      </div>

      <a
        href={waLink(person.phone_e164, defaultMessage(person.full_name))}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-semibold text-white"
      >
        <span>💬</span> Message on WhatsApp
      </a>

      <Section title="Stage">
        <StageStepper personId={person.id} current={person.stage} />
      </Section>

      <Section title="Preferences & notes">
        <form action={saveNotesAction} className="flex flex-col gap-2">
          <input type="hidden" name="personId" value={person.id} />
          <textarea
            name="notes"
            rows={3}
            dir="auto"
            defaultValue={person.notes}
            placeholder="Sizes, colours, occasions, preferred contact time…"
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="self-end rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Save notes
          </button>
        </form>
      </Section>

      <Section title="Purchase history">
        <OrderHistory orders={(orders ?? []) as Order[]} />
      </Section>

      <Section title="Activity">
        <details className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <summary className="cursor-pointer text-sm font-medium">＋ Add follow-up / note</summary>
          <form action={addActivityAction} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="personId" value={person.id} />
            <select
              name="type"
              defaultValue="follow_up"
              className="h-11 rounded-xl border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="follow_up">Follow-up</option>
              <option value="appointment">Appointment</option>
              <option value="note">Note</option>
            </select>
            <input
              name="title"
              placeholder="Title (e.g. Call about Eid collection)"
              dir="auto"
              className="h-11 rounded-xl border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
            <input
              name="dueAt"
              type="datetime-local"
              className="h-11 rounded-xl border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
            <textarea
              name="body"
              rows={2}
              placeholder="Details (optional)"
              dir="auto"
              className="rounded-xl border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button className="h-11 rounded-xl bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Add
            </button>
          </form>
        </details>
        <ActivityTimeline
          personId={person.id}
          activities={(activities ?? []) as Activity[]}
          history={(history ?? []) as StageHistoryRow[]}
        />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">{title}</h2>
      {children}
    </section>
  );
}
