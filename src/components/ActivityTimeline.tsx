import { completeActivityAction } from '@/app/people/[id]/actions';
import { type Activity, type StageHistoryRow, STAGE_META } from '@/lib/types';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const dueLabel = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
};

const TYPE_LABEL: Record<string, string> = {
  appointment: 'Appointment',
  follow_up: 'Follow-up',
  note: 'Note',
};

export default function ActivityTimeline({
  personId,
  activities,
  history,
}: {
  personId: string;
  activities: Activity[];
  history: StageHistoryRow[];
}) {
  const upcoming = activities
    .filter((a) => a.status === 'due' && a.due_at)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!));

  type Item = { key: string; at: string; node: React.ReactNode };
  const items: Item[] = [];

  for (const a of activities.filter((x) => x.status === 'done' || !x.due_at)) {
    const at = a.completed_at ?? a.created_at;
    items.push({
      key: `a-${a.id}`,
      at,
      node: (
        <p className="text-sm text-ink">
          <span className="font-semibold">{a.title}</span>
          {a.body && (
            <span className="text-muted" dir="auto">
              {' '}
              — {a.body}
            </span>
          )}
        </p>
      ),
    });
  }
  for (const h of history) {
    items.push({
      key: `h-${h.id}`,
      at: h.changed_at,
      node: (
        <p className="text-sm text-ink">
          Stage moved to <span className="font-semibold">{STAGE_META[h.to_stage].label}</span>
        </p>
      ),
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-5">
      {upcoming.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Upcoming</p>
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-gold-soft p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{a.title}</p>
                  <p className="text-xs text-gold">
                    {TYPE_LABEL[a.type]} · {dueLabel(a.due_at!)}
                  </p>
                </div>
                <form action={completeActivityAction}>
                  <input type="hidden" name="activityId" value={a.id} />
                  <input type="hidden" name="personId" value={personId} />
                  <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg">
                    Done
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2">History</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((it) => (
              <li key={it.key} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-gold" />
                <div className="flex flex-col">
                  {it.node}
                  <span className="text-xs text-muted">{when(it.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
