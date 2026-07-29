import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { computeFunnel, type Period, type FunnelCounts } from '@/lib/reporting';
import Funnel from '@/components/Funnel';
import Lotus from '@/components/Lotus';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const overall = (c: FunnelCounts) =>
  c.contacted ? Math.round((c.purchased / c.contacted) * 100) : null;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await getSessionProfile();
  if (!me || me.role !== 'manager') {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">
        <Lotus className="mx-auto mb-4 w-10" />
        <h1 className="text-lg font-semibold text-heading">Team funnel</h1>
        <p className="mt-2 text-sm text-muted">This view is for managers.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-gold hover:underline">
          ← Back to Today
        </Link>
      </main>
    );
  }

  const { period: raw } = await searchParams;
  const period: Period = raw === 'day' || raw === 'week' || raw === 'month' ? raw : 'month';
  const { team, associates, label } = await computeFunnel(period);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10">
      <header className="flex items-center gap-3 py-5">
        <Lotus className="w-8" />
        <div>
          <p className="eyebrow">Team funnel · {label}</p>
          <h1 className="text-xl font-semibold tracking-tight text-heading">How the team is doing</h1>
        </div>
      </header>

      <p className="mb-5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        A coaching view. The <span className="font-semibold text-ink">conversion between steps</span>{' '}
        matters more than raw totals — it shows where a client relationship needs help.
      </p>

      <div className="mb-6 flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/reports?period=${p.key}`}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              period === p.key
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line text-muted hover:border-line-strong'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-heading">Whole team</h2>
          <span className="text-sm text-muted">
            Spoke to → purchased:{' '}
            <span className="font-semibold text-ink">
              {overall(team) === null ? '—' : `${overall(team)}%`}
            </span>
          </span>
        </div>
        <Funnel counts={team} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-heading">By sales executive</h2>
        {associates.length === 0 ? (
          <p className="text-sm text-muted">No tracked activity in this period yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {associates.map((a) => (
              <div key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="font-semibold text-ink">{a.name}</h3>
                  <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-chip-fg">
                    {overall(a.counts) === null ? '—' : `${overall(a.counts)}%`}
                  </span>
                </div>
                <Funnel counts={a.counts} showConversions={false} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
