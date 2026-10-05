import type { FollowUpDay } from '@/lib/reporting';

/** Per-day outreach bars. Plain divs, matching Funnel.tsx — this project has
 *  no charting library and doesn't need one for a single bar list. */
export default function FollowUpDays({ days }: { days: FollowUpDay[] }) {
  const denom = Math.max(...days.map((d) => d.touches), 1);

  return (
    <div className="flex flex-col gap-2">
      {days.map((d) => {
        const w = Math.round((d.touches / denom) * 100);
        return (
          <div key={d.date} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-muted">{d.label}</span>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
              <div
                className="h-full rounded-md bg-accent"
                style={{ width: `${Math.max(w, d.touches > 0 ? 6 : 0)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
              {d.touches}
              {d.clients > 0 && (
                <span className="ml-1 text-xs font-normal text-muted">/ {d.clients}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
