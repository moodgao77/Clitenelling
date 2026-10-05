import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import StageStepper from '@/components/StageStepper';
import ActivityTimeline from '@/components/ActivityTimeline';
import OrderHistory from '@/components/OrderHistory';
import WhatsAppButton from '@/components/WhatsAppButton';
import AssignOwner from '@/components/AssignOwner';
import AssignSalesExecutive from '@/components/AssignSalesExecutive';
import NotesLog from '@/components/NotesLog';
import {
  assignToMeAction,
  saveNotesAction,
  addActivityAction,
  addNoteAction,
  reopenClientAction,
} from './actions';
import { waLink, defaultMessage } from '@/lib/whatsapp';
import { CLOSE_OUTCOME } from '@/lib/notes';
import {
  SOURCE_LABEL,
  STAGES,
  STAGE_META,
  type Person,
  type Order,
  type Activity,
  type StageHistoryRow,
  type SalesExecutive,
} from '@/lib/types';

const closedWhen = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  });

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

  const [
    { data: orders },
    { data: activities },
    { data: history },
    { data: ownerRow },
    { data: salesExecutives },
  ] = await Promise.all([
    supabase.from('orders').select('*').eq('person_id', id).order('ordered_at', { ascending: false }),
    supabase.from('activities').select('*').eq('person_id', id),
    supabase.from('stage_history').select('*').eq('person_id', id).order('changed_at', { ascending: false }),
    person.owner_id
      ? supabase.from('profiles').select('full_name').eq('id', person.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('sales_executives')
      .select('id, name')
      .eq('active', true)
      .order('sort_order')
      .returns<Pick<SalesExecutive, 'id' | 'name'>[]>(),
  ]);

  const isMine = !!me && person.owner_id === me.id;
  const isManager = me?.role === 'manager';
  const ownerLabel = !person.owner_id
    ? 'Unassigned'
    : isMine
      ? 'You'
      : (ownerRow as { full_name?: string } | null)?.full_name ?? 'Another associate';

  const { data: members } = isManager
    ? await supabase.from('profiles').select('id, full_name').order('full_name')
    : { data: null };

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
        {person.source_detail && (
          <p className="mt-1 text-sm text-muted" dir="auto">
            Source: {person.source_detail}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-chip px-3 py-1 text-xs font-medium uppercase tracking-wide text-chip-fg">
            Owner: {ownerLabel}
          </span>
          <AssignSalesExecutive
            personId={person.id}
            currentSalesExecutiveId={person.sales_executive_id}
            executives={salesExecutives ?? []}
          />
          {isManager ? (
            <AssignOwner
              personId={person.id}
              currentOwnerId={person.owner_id}
              members={members ?? []}
            />
          ) : (
            !person.owner_id && (
              <form action={assignToMeAction}>
                <input type="hidden" name="personId" value={person.id} />
                <button className="rounded-full border border-accent px-3 py-1 text-xs font-semibold text-heading">
                  Assign to me
                </button>
              </form>
            )
          )}
        </div>
      </div>

      {person.closed_at && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-gold-soft p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">Closed</span>
            {person.closed_reason ? ` — ${person.closed_reason}` : ''} ·{' '}
            {closedWhen(person.closed_at)}
          </p>
          <form action={reopenClientAction}>
            <input type="hidden" name="personId" value={person.id} />
            <button className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-heading">
              Reopen
            </button>
          </form>
        </div>
      )}

      <div className="mb-7">
        <WhatsAppButton
          href={waLink(person.phone_e164, defaultMessage(person.full_name))}
          personId={person.id}
        />
      </div>

      <Section title="Stage">
        <StageStepper personId={person.id} current={person.stage} />
      </Section>

      <Section title="Notes">
        <form action={addNoteAction} className="mb-4 flex flex-col gap-2">
          <input type="hidden" name="personId" value={person.id} />
          <textarea
            name="note"
            rows={3}
            dir="auto"
            required
            placeholder="What happened on the call or message?"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-colors focus:border-gold"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              What happened?
              <select
                name="outcome"
                defaultValue=""
                className="h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-gold"
              >
                <option value="">No change</option>
                {STAGES.filter((s) => s !== 'uncontacted').map((s) => (
                  <option key={s} value={s}>
                    {STAGE_META[s].label}
                  </option>
                ))}
                <option value={CLOSE_OUTCOME}>Not interested — close</option>
              </select>
            </label>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
              Save note
            </button>
          </div>
        </form>
        <NotesLog activities={(activities ?? []) as Activity[]} />
      </Section>

      <Section title="Preferences">
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
            Save preferences
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
