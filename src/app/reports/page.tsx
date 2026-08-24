import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import {
  computeFunnel,
  todayDubaiISO,
  startOfMonthDubaiISO,
  addDaysISO,
  type FunnelCounts,
} from '@/lib/reporting';
import Funnel from '@/components/Funnel';
import Lotus from '@/components/Lotus';
import ReportFilters from '@/components/ReportFilters';

// Always render fresh — the funnel must reflect the exact range every time.
export const dynamic = 'force-dynamic';

const overall = (c: FunnelCounts) =>
  c.contacted ? Math.round((c.purchased / c.contacted) * 100) : null;

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function drilldownHref(stage: string, from: string, to: string, salesExecutiveId?: string) {
  const params = new URLSearchParams({ funnelStage: stage, from, to });
  if (salesExecutiveId) params.set('salesExecutive', salesExecutiveId);
  return `/people?${params.toString()}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
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

  const today = todayDubaiISO();
  const sp = await searchParams;
  let to = isDate(sp.to) && sp.to! <= today ? sp.to! : today;
  let from = isDate(sp.from) && sp.from! <= today ? sp.from! : startOfMonthDubaiISO();
  if (from > to) [from, to] = [to, from];

  const { team, associates, label } = await computeFunnel(from, to);

  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Last 3 days', from: addDaysISO(today, -2), to: today },
    { label: 'Last 7 days', from: addDaysISO(today, -6), to: today },
    { label: 'This month', from: startOfMonthDubaiISO(), to: today },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10">
      <header className="flex items-start justify-between gap-3 py-5">
        <div>
          <p className="eyebrow">Team funnel · {label}</p>
          <h1 className="text-xl font-semibold tracking-tight text-heading">How the team is doing</h1>
        </div>
        <a
          href="/reports/export"
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-medium text-heading transition-colors hover:border-line-strong"
        >
          Export CSV
        </a>
      </header>

      <p className="mb-5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        A coaching view. The <span className="font-semibold text-ink">conversion between steps</span>{' '}
        matters more than raw totals — it shows where a client relationship needs help.
      </p>

      <div className="mb-6">
        <ReportFilters from={from} to={to} max={today} presets={presets} />
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
        <Funnel counts={team} hrefForStage={(stage) => drilldownHref(stage, from, to)} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-heading">By sales executive</h2>
        {associates.length === 0 ? (
          <p className="text-sm text-muted">No tracked activity in this range yet.</p>
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
                <Funnel
                  counts={a.counts}
                  showConversions={false}
                  hrefForStage={(stage) => drilldownHref(stage, from, to, a.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
