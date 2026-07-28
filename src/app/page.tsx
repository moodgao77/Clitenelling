import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { dubaiDayBounds, dueTime, overdueDays } from '@/lib/day';
import { completeReminder } from './home-actions';
import Lotus from '@/components/Lotus';
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

  // Prospecting pool — warm leads to work when the queue is clear.
  const { data: pool } = await supabase
    .from('people')
    .select('id, full_name, phone_e164, stage')
    .eq('stage', 'uncontacted')
    .order('updated_at', { ascending: false })
    .limit(8)
    .returns<Client[]>();

  const allClear = reminders.length === 0;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-8">
      <header className="flex items-center gap-3 py-5">
        <Lotus className="w-8" />
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1 className="text-xl font-semibold tracking-tight text-heading">
            {me ? `Good day, ${me.full_name.split(' ')[0]}` : 'Today'}
          </h1>
        </div>
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
