'use client';

import { useRouter } from 'next/navigation';

type Preset = { label: string; from: string; to: string };

/** Date-range controls for the funnel: quick presets + a custom From/To.
 *  Every change pushes the new range AND refreshes, so the server re-renders
 *  the funnel for the exact range (no stale cache). */
export default function ReportFilters({
  from,
  to,
  max,
  presets,
}: {
  from: string;
  to: string;
  max: string;
  presets: Preset[];
}) {
  const router = useRouter();

  function go(f: string, t: string) {
    const nf = f > t ? t : f;
    const nt = f > t ? f : t;
    router.push(`/reports?from=${nf}&to=${nt}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => go(p.from, p.to)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-line text-muted hover:border-line-strong'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && go(e.target.value, to)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">To</span>
          <input
            type="date"
            value={to}
            min={from}
            max={max}
            onChange={(e) => e.target.value && go(from, e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
      </div>
    </div>
  );
}
