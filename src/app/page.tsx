import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { dubaiDayBounds, dueTime, overdueDays } from '@/lib/day';
import { latestPerClient, noteWrittenAt } from '@/lib/notes';
import { completeReminder } from './home-actions';
import StageBadge from '@/components/StageBadge';
import type { Stage } from '@/lib/types';

type Client = { id: string; full_name: string; phone_e164: string; stage: Stage };
type Reminder = {
  id: string;
  title: string;
  type: string;
  due_at: string;
  people: Client | null;
};
type Touch = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  completed_at: string | null;
  people: (Client & { closed_at: string | null }) | null;
};

/** When a client was last worked, in Dubai time. */
const touchedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });

const TYPE_LABEL: Record<string, string> = {
  appointment: 'Appointment',
  follow_up: 'Follow-up',
  note: 'Note',
};

export default async function TodayPage() {
  const me = await getSessionProfile();
  const supabase = await createServerSupabase();
  const { startISO, endISO, todayLabel } = dubaiDayBounds();

  // Reminders due by end of today (overdue included), soonest first.
  const { data: due } = await supabase
    .from('activities')
    .select('id, title, type, due_at, people:person_id (id, full_name, phone_e164, stage)')
    .eq('status', 'due')
    .not('due_at', 'is', null)
    .lte('due_at', endISO)
    .order('due_at', { ascending: true })
    .returns<Reminder[]>();

  const reminders = due ?? [];
  const overdue = reminders.filter((r) => r.due_at < startISO);
  const today = reminders.filter((r) => r.due_at >= startISO);

  // What the team is actually working right now. Driven by the activity trail
  // rather than people.updated_at, which a sync can bump without anyone
  // touching the client.
  const { data: touches } = await supabase
    .from('activities')
    .select(
      'id, title, body, created_at, completed_at, people:person_id (id, full_name, phone_e164, stage, closed_at)',
    )
    .order('created_at', { ascending: false })
    .limit(80)
    .returns<Touch[]>();

  const active = latestPerClient(
    (touches ?? []).filter((t) => t.people && !t.people.closed_at),
    6,
  ).map((t) => ({
    key: t.id,
    text: t.body.trim() || t.title,
    at: noteWrittenAt(t),
    client: t.people as Client,
  }));

  // Prospecting pool — warm leads to work when the queue is clear.
  const { data: pool } = await supabase
    .from('people')
    .select('id, full_name, phone_e164, stage')
    .eq('stage', 'uncontacted')
    .is('closed_at', null)
    .order('updated_at', { ascending: false })
    .limit(8)
    .returns<Client[]>();

  const allClear = reminders.length === 0;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-8">
      <header className="py-5">
        <p className="eyebrow">{todayLabel}</p>
        <h1 className="text-xl font-semibold tracking-tight text-heading">
          {me ? `Good day, ${me.full_name.split(' ')[0]}` : 'Today'}
        </h1>
      </header>

      {overdue.length > 0 && (
        <section className="mb-6">
          <p className="eyebrow mb-2.5" style={{ color: 'var(--danger)' }}>
            Overdue · {overdue.length}
          </p>
          <ul className="flex flex-col gap-2.5">
            {overdue.map((r) => (
              <ReminderCard key={r.id} r={r} overdue />
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <p className="eyebrow mb-2.5">Today’s actions · {today.length}</p>
        {today.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-center text-sm text-muted">
            {allClear
              ? 'Nothing due today. Beautifully clear — reach out to a warm lead below.'
              : 'No more reminders for today. The overdue ones above still need you.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {today.map((r) => (
              <ReminderCard key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-2.5 flex items-baseline justify-between">
          <p className="eyebrow">Active conversations</p>
          <Link href="/people" className="text-xs text-muted hover:underline">
            See all
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-muted">
            No conversations yet. Reach out to a lead below to start one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {active.map((a) => (
              <li key={a.key}>
                <Link
                  href={`/people/${a.client.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink" dir="auto">
                      {a.client.full_name || 'Unnamed'}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted" dir="auto">
                      {a.text}
                    </p>
                    <p className="mt-1 text-xs text-gold">{touchedAt(a.at)}</p>
                  </div>
                  <StageBadge stage={a.client.stage} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <p className="eyebrow">To reach out</p>
          <Link href="/people?stage=uncontacted" className="text-xs text-muted hover:underline">
            See all
          </Link>
        </div>
        {(pool ?? []).length === 0 ? (
          <p className="text-sm text-muted">No uncontacted leads right now.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {(pool ?? []).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/people/${p.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink" dir="auto">
                      {p.full_name || 'Unnamed'}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted" dir="ltr">
                      {p.phone_e164}
                    </p>
                  </div>
                  <StageBadge stage={p.stage} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ReminderCard({ r, overdue = false }: { r: Reminder; overdue?: boolean }) {
  const client = r.people;
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        overdue ? 'border-line-strong bg-gold-soft' : 'border-line bg-surface'
      }`}
    >
      <Link href={client ? `/people/${client.id}` : '#'} className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink" dir="auto">
          {client?.full_name || 'Client'}
        </p>
        <p className="mt-0.5 truncate text-sm text-ink">{r.title}</p>
        <p className="mt-1 text-xs text-gold">
          {TYPE_LABEL[r.type] ?? 'Reminder'} ·{' '}
          {overdue ? `Overdue ${overdueDays(r.due_at)}d` : dueTime(r.due_at)}
        </p>
      </Link>
      <form action={completeReminder}>
        <input type="hidden" name="activityId" value={r.id} />
        <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg">
          Done
        </button>
      </form>
    </li>
  );
}
