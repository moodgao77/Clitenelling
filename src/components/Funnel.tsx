import Link from 'next/link';
import { FUNNEL_STAGES, stepConversion, type FunnelCounts } from '@/lib/reporting';
import type { Stage } from '@/lib/types';

/** Horizontal bar funnel in a single brand hue. Bar length encodes magnitude
 *  (distinct clients at each stage); the conversion % between steps is the
 *  headline the brief cares about. */
export default function Funnel({
  counts,
  showConversions = true,
  hrefForStage,
}: {
  counts: FunnelCounts;
  showConversions?: boolean;
  hrefForStage?: (stage: Stage) => string;
}) {
  const values = FUNNEL_STAGES.map((s) => counts[s.stage]);
  const denom = Math.max(...values, 1);

  return (
    <div className="flex flex-col gap-2">
      {FUNNEL_STAGES.map((s, i) => {
        const c = counts[s.stage];
        const w = Math.round((c / denom) * 100);
        const conv = stepConversion(counts, i);
        const href = c > 0 ? hrefForStage?.(s.stage) : undefined;
        return (
          <div key={s.stage}>
            {showConversions && i > 0 && (
              <p className="mb-1 pl-24 text-[11px] font-medium text-gold">
                ↓ {conv === null ? '—' : `${conv}%`}
                <span className="text-muted"> to {s.label.toLowerCase()}</span>
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-muted">{s.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
                <div
                  className="h-full rounded-md bg-accent"
                  style={{ width: `${Math.max(w, c > 0 ? 6 : 0)}%` }}
                />
              </div>
              {href ? (
                <Link
                  href={href}
                  aria-label={`View ${s.label.toLowerCase()} clients`}
                  className="w-8 shrink-0 rounded text-right text-sm font-semibold tabular-nums text-ink underline-offset-4 hover:text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {c}
                </Link>
              ) : (
                <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                  {c}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
