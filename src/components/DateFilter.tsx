'use client';

import { useRouter } from 'next/navigation';

/** Native calendar picker that anchors the funnel to a chosen date.
 *  Changing it reloads the report for that date + current granularity. */
export default function DateFilter({
  period,
  date,
  max,
}: {
  period: string;
  date: string;
  max: string;
}) {
  const router = useRouter();

  function go(next: string) {
    if (next) router.push(`/reports?period=${period}&date=${next}`);
  }

  function shift(days: number) {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    const iso = d.toISOString().slice(0, 10);
    if (iso <= max) go(iso);
  }

  const atToday = date >= max;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Previous day"
        className="h-9 w-9 rounded-lg border border-line text-muted transition-colors hover:border-line-strong"
      >
        ‹
      </button>
      <input
        type="date"
        value={date}
        max={max}
        onChange={(e) => go(e.target.value)}
        className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-gold"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={atToday}
        aria-label="Next day"
        className="h-9 w-9 rounded-lg border border-line text-muted transition-colors hover:border-line-strong disabled:opacity-40"
      >
        ›
      </button>
      {!atToday && (
        <button
          type="button"
          onClick={() => go(max)}
          className="text-sm text-gold underline-offset-4 hover:underline"
        >
          Today
        </button>
      )}
    </div>
  );
}
