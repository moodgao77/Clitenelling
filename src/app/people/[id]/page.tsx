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
    <main className="mx-auto w-full max-w-xl px-4 pb-12">
      <header className="flex items-center justify-between py-4">
        <Link href="/people" className="text-sm text-muted underline-offset-4 hover:underline">
          ‹ Clients
        </Link>
        <span className="eyebrow">{SOURCE_LABEL[person.source]}</span>
      </header>

      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-heading" dir="auto">
          {person.full_name || 'Unnamed'}
        </h1>
        <p className="mt-1 text-muted" dir="ltr">
          {person.phone_e164}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="rounded-full bg-chip px-3 py-1 text-xs font-medium uppercase tracking-wide text-chip-fg">
            {ownerLabel}
          </span>
          {!person.owner_id && (
            <form action={assignToMeAction}>
              <input type="hidden" name="personId" value={person.id} />
              <button className="rounded-full border border-accent px-3 py-1 text-xs font-semibold text-heading">
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
        className="mb-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-accent-fg"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[var(--accent-fg)]" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm-2.7 4.3c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3 4.8 4.1 2.4 1 2.9.8 3.4.8.5-.1 1.6-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.2-.7.1l-.7.9c-.1.2-.3.2-.5.1-.3-.1-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-1-2.3c-.2-.5-.4-.4-.6-.4z" />
        </svg>
        Message on WhatsApp
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
            className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-colors focus:border-gold"
          />
          <button className="self-end rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
            Save notes
          </button>
        </form>
      </Section>

      <Section title="Purchase history">
        <OrderHistory orders={(orders ?? []) as Order[]} />
      </Section>

      <Section title="Activity">
        <details className="mb-4 rounded-xl border border-line bg-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold text-heading">
            + Add follow-up or note
          </summary>
          <form action={addActivityAction} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="personId" value={person.id} />
            <select
              name="type"
              defaultValue="follow_up"
              className="h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink"
            >
              <option value="follow_up">Follow-up</option>
              <option value="appointment">Appointment</option>
              <option value="note">Note</option>
            </select>
            <input
              name="title"
              placeholder="Title (e.g. Call about Eid collection)"
              dir="auto"
              className="h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none focus:border-gold"
            />
            <input
              name="dueAt"
              type="datetime-local"
              className="h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink"
            />
            <textarea
              name="body"
              rows={2}
              placeholder="Details (optional)"
              dir="auto"
              className="rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-gold"
            />
            <button className="h-11 rounded-xl bg-accent text-sm font-semibold text-accent-fg">
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
    <section className="mb-7">
      <p className="eyebrow mb-2.5">{title}</p>
      {children}
    </section>
  );
}
