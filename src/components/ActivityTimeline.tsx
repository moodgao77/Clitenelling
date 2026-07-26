import { completeActivityAction } from '@/app/people/[id]/actions';
import { STAGE_META, type Activity, type StageHistoryRow } from '@/lib/types';

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

const TYPE_ICON: Record<string, string> = { appointment: '📅', follow_up: '🔔', note: '📝' };

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

  // History: done/undated activities + every stage change, newest first.
  type Item = { key: string; at: string; node: React.ReactNode };
  const items: Item[] = [];

  for (const a of activities.filter((x) => x.status === 'done' || !x.due_at)) {
    const at = a.completed_at ?? a.created_at;
    items.push({
      key: `a-${a.id}`,
      at,
      node: (
        <p className="text-sm">
          <span className="mr-1">{TYPE_ICON[a.type] ?? '•'}</span>
          <span className="font-medium">{a.title}</span>
          {a.body && <span className="text-neutral-500" dir="auto"> — {a.body}</span>}
        </p>
      ),
    });
  }
  for (const h of history) {
    items.push({
      key: `h-${h.id}`,
      at: h.changed_at,
      node: (
        <p className="text-sm">
          <span className="mr-1">➡️</span>
          Stage → <span className="font-medium">{STAGE_META[h.to_stage].label}</span>
        </p>
      ),
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-4">
      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Upcoming
          </h3>
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className="mr-1">{TYPE_ICON[a.type] ?? '🔔'}</span>
                    {a.title}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{dueLabel(a.due_at!)}</p>
                </div>
                <form action={completeActivityAction}>
                  <input type="hidden" name="activityId" value={a.id} />
                  <input type="hidden" name="personId" value={personId} />
                  <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
                    Done
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          History
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((it) => (
              <li key={it.key} className="flex flex-col">
                {it.node}
                <span className="text-xs text-neutral-400">{when(it.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
