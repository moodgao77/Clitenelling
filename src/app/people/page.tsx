import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import PersonCard from '@/components/PersonCard';
import {
  filterFunnelDrilldownRows,
  funnelStageLabel,
  isFunnelStage,
  rangeBounds,
  startOfMonthDubaiISO,
  todayDubaiISO,
  UNASSIGNED_EXECUTIVE_ID,
  type FunnelDrilldownRow,
} from '@/lib/reporting';
import { STAGES, STAGE_META, type Person, type Stage } from '@/lib/types';
import Link from 'next/link';

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

type PeopleListPerson = Pick<Person, 'id' | 'full_name' | 'phone_e164' | 'stage' | 'sales_executive_id'>;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    funnelStage?: string;
    from?: string;
    to?: string;
    salesExecutive?: string;
  }>;
}) {
  const sp = await searchParams;
  const { q, stage } = sp;
  const me = await getSessionProfile();
  const supabase = await createServerSupabase();

  const { data: salesExecutives } = await supabase
    .from('sales_executives')
    .select('id, name')
    .order('sort_order');
  const salesExecutiveNameById = new Map((salesExecutives ?? []).map((p) => [p.id, p.name]));

  const today = todayDubaiISO();
  let to = isDate(sp.to) && sp.to! <= today ? sp.to! : today;
  let from = isDate(sp.from) && sp.from! <= today ? sp.from! : startOfMonthDubaiISO();
  if (from > to) [from, to] = [to, from];

  const funnelStage = isFunnelStage(sp.funnelStage) ? sp.funnelStage : undefined;
  const drilldownMode = !!funnelStage && me?.role === 'manager';
  const cleaned = (q ?? '').replace(/[,()%]/g, ' ').trim().toLowerCase();

  let people: PeopleListPerson[] = [];

  if (drilldownMode) {
    const { startISO, endISO } = rangeBounds(from, to);
    const { data } = await supabase
      .from('stage_history')
      .select('person_id, people:person_id (id, full_name, phone_e164, stage, sales_executive_id)')
      .eq('to_stage', funnelStage)
      .not('from_stage', 'is', null)
      .gte('changed_at', startISO)
      .lt('changed_at', endISO)
      .order('changed_at', { ascending: false })
      .returns<FunnelDrilldownRow[]>();

    people = filterFunnelDrilldownRows(data ?? [], sp.salesExecutive);
    if (cleaned) {
      people = people.filter(
        (p) =>
          p.full_name.toLowerCase().includes(cleaned) ||
          p.phone_e164.toLowerCase().includes(cleaned),
      );
    }
  } else {
    let query = supabase
      .from('people')
      .select('id, full_name, phone_e164, stage, owner_id, sales_executive_id')
      .order('updated_at', { ascending: false })
      .limit(200);

    const activeStage = STAGES.includes(stage as Stage) ? (stage as Stage) : undefined;
    if (activeStage) query = query.eq('stage', activeStage);

    if (cleaned) {
      query = query.or(`full_name.ilike.%${cleaned}%,phone_e164.ilike.%${cleaned}%`);
    }

    const { data } = await query;
    people = data ?? [];
  }

  const activeStage = !drilldownMode && STAGES.includes(stage as Stage) ? (stage as Stage) : undefined;
  const title = drilldownMode
    ? `${funnelStageLabel(funnelStage)} clients`
    : me
      ? `${me.full_name.split(' ')[0]}’s clients`
      : 'Clients';
  const salesExecutiveLabel = drilldownMode ? drilldownSalesExecutiveLabel(sp.salesExecutive, salesExecutiveNameById) : null;

  function assignmentLabel(p: Pick<Person, 'sales_executive_id'>) {
    if (!p.sales_executive_id) return 'Sales executive: Unassigned';
    return `Sales executive: ${salesExecutiveNameById.get(p.sales_executive_id) ?? 'Unknown'}`;
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-6">
      <header className="py-5">
        <h1 className="text-xl font-semibold tracking-tight text-heading">{title}</h1>
        {drilldownMode && (
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted">
            <p>
              Team funnel · {from} to {to} · {salesExecutiveLabel}
            </p>
            <Link href={buildReportHref(from, to)} className="font-medium text-gold hover:underline">
              ← Back to funnel
            </Link>
          </div>
        )}
      </header>

      <form method="get" className="mb-3">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or phone…"
          className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-gold"
        />
        {drilldownMode ? (
          <>
            <input type="hidden" name="funnelStage" value={funnelStage} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            {sp.salesExecutive && <input type="hidden" name="salesExecutive" value={sp.salesExecutive} />}
          </>
        ) : (
          activeStage && <input type="hidden" name="stage" value={activeStage} />
        )}
      </form>

      {!drilldownMode && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <FilterChip label="All" href={buildHref(q, undefined)} active={!activeStage} />
          {STAGES.map((s) => (
            <FilterChip
              key={s}
              label={STAGE_META[s].label}
              href={buildHref(q, s)}
              active={activeStage === s}
            />
          ))}
        </div>
      )}

      <p className="mb-2 text-xs text-muted">
        {people.length} {people.length === 1 ? 'person' : 'people'}
      </p>

      <ul className="flex flex-col gap-2.5">
        {people.map((p) => (
          <li key={p.id}>
            <PersonCard person={p} ownerLabel={assignmentLabel(p)} />
          </li>
        ))}
      </ul>

      {people.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted">
          {drilldownMode ? (
            'No clients match this funnel number yet.'
          ) : (
            <>
              No one here yet. Tap <span className="font-semibold text-heading">Add</span> to add a
              contact.
            </>
          )}
        </p>
      )}
    </main>
  );
}

function buildHref(q: string | undefined, stage: Stage | undefined) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (stage) params.set('stage', stage);
  const s = params.toString();
  return s ? `/people?${s}` : '/people';
}

function buildReportHref(from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  return `/reports?${params.toString()}`;
}

function drilldownSalesExecutiveLabel(
  salesExecutiveId: string | undefined,
  salesExecutiveNameById: Map<string, string>,
) {
  if (!salesExecutiveId) return 'Whole team';
  if (salesExecutiveId === UNASSIGNED_EXECUTIVE_ID) return 'Unassigned';
  return salesExecutiveNameById.get(salesExecutiveId) ?? 'Unknown';
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line text-muted hover:border-line-strong'
      }`}
    >
      {label}
    </Link>
  );
}
