import { createServerSupabase } from '@/lib/supabase/server';
import type { Person, Stage } from '@/lib/types';

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY = 86_400_000;

/** The measurable funnel. "Spoke to" = Contacted; "Answered" = Replied. */
export const FUNNEL_STAGES: { stage: Stage; label: string }[] = [
  { stage: 'contacted', label: 'Spoke to' },
  { stage: 'replied', label: 'Answered' },
  { stage: 'visit_booked', label: 'Booked' },
  { stage: 'visited', label: 'Visited' },
  { stage: 'purchased', label: 'Purchased' },
];

// ---- Dubai-local date helpers (dates are 'YYYY-MM-DD') ----
export function todayDubaiISO(): string {
  const d = new Date(Date.now() + DUBAI_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function startOfMonthDubaiISO(): string {
  return todayDubaiISO().slice(0, 8) + '01';
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dayStartUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - DUBAI_OFFSET_MS;
};

const fmt = (ms: number, withWeekday = false) =>
  new Date(ms).toLocaleDateString('en-GB', {
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  });

/** Inclusive [from, to] range of Dubai days → a query window + a human label. */
export function rangeBounds(fromDate: string, toDate: string) {
  let from = fromDate;
  let to = toDate;
  if (from > to) [from, to] = [to, from]; // tolerate reversed input
  const startUTC = dayStartUTC(from);
  const endUTC = dayStartUTC(to) + DAY; // inclusive of the last day
  const label = from === to ? fmt(startUTC, true) : `${fmt(startUTC)} – ${fmt(endUTC - DAY)}`;
  return { startISO: new Date(startUTC).toISOString(), endISO: new Date(endUTC).toISOString(), label };
}

export type FunnelCounts = Record<string, number>;
export type AssociateFunnel = { id: string; name: string; counts: FunnelCounts };
export type FunnelHistoryRow = {
  to_stage: string;
  person_id: string;
  people: { sales_executive_id: string | null } | null;
};
export type FunnelDrilldownPerson = Pick<
  Person,
  'id' | 'full_name' | 'phone_e164' | 'stage' | 'sales_executive_id'
>;
export type FunnelDrilldownRow = {
  person_id: string;
  people: FunnelDrilldownPerson | null;
};

export const UNASSIGNED_EXECUTIVE_ID = 'unassigned';

const emptyCounts = (): FunnelCounts =>
  Object.fromEntries(FUNNEL_STAGES.map((s) => [s.stage, 0])) as FunnelCounts;

const toCounts = (rec: Record<string, Set<string>>): FunnelCounts => {
  const c = emptyCounts();
  for (const s of FUNNEL_STAGES) c[s.stage] = rec[s.stage]?.size ?? 0;
  return c;
};

export function isFunnelStage(stage?: string): stage is Stage {
  return !!stage && FUNNEL_STAGES.some((s) => s.stage === stage);
}

export function funnelStageLabel(stage: Stage) {
  return FUNNEL_STAGES.find((s) => s.stage === stage)?.label ?? stage;
}

export function filterFunnelDrilldownRows(
  rows: FunnelDrilldownRow[],
  salesExecutiveId?: string,
): FunnelDrilldownPerson[] {
  const people = new Map<string, FunnelDrilldownPerson>();

  for (const row of rows) {
    const person = row.people;
    if (!person) continue;

    if (salesExecutiveId === UNASSIGNED_EXECUTIVE_ID && person.sales_executive_id !== null) continue;
    if (
      salesExecutiveId &&
      salesExecutiveId !== UNASSIGNED_EXECUTIVE_ID &&
      person.sales_executive_id !== salesExecutiveId
    ) {
      continue;
    }

    if (!people.has(person.id)) people.set(person.id, person);
  }

  return [...people.values()];
}

export function aggregateFunnelRows(
  rows: FunnelHistoryRow[],
  salesExecutiveNames: Map<string, string>,
) {
  const team: Record<string, Set<string>> = {};
  const perExecutive = new Map<string, Record<string, Set<string>>>();
  const orderById = new Map<string, number>();

  let order = 0;
  for (const id of salesExecutiveNames.keys()) orderById.set(id, order++);
  orderById.set(UNASSIGNED_EXECUTIVE_ID, order);

  for (const row of rows) {
    const stage = row.to_stage;
    (team[stage] ??= new Set()).add(row.person_id);

    const executiveId = row.people?.sales_executive_id ?? UNASSIGNED_EXECUTIVE_ID;
    if (!perExecutive.has(executiveId)) perExecutive.set(executiveId, {});
    const executive = perExecutive.get(executiveId)!;
    (executive[stage] ??= new Set()).add(row.person_id);
  }

  const associates: AssociateFunnel[] = [...perExecutive.entries()]
    .map(([id, rec]) => ({
      id,
      name: id === UNASSIGNED_EXECUTIVE_ID ? 'Unassigned' : salesExecutiveNames.get(id) ?? 'Unknown',
      counts: toCounts(rec),
    }))
    .sort((a, b) => {
      const contactedDelta = b.counts.contacted - a.counts.contacted;
      if (contactedDelta !== 0) return contactedDelta;
      return (orderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderById.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    });

  return { team: toCounts(team), associates };
}

/**
 * Counts, over a date range, how many distinct clients ENTERED each funnel
 * stage — team-wide and per sales executive assigned on the client record.
 * Reads the timestamped stage_history ledger, so the funnel can't be gamed.
 */
export async function computeFunnel(fromDate: string, toDate: string) {
  const supabase = await createServerSupabase();
  const { startISO, endISO, label } = rangeBounds(fromDate, toDate);

  // Count only REAL transitions (from_stage present). Rows with a null
  // from_stage are the initial state written when a person is created/imported
  // — those aren't associate-driven funnel activity and would otherwise inflate
  // counts (e.g. a Shopify buyer imported as "Purchased" today).
  const { data } = await supabase
    .from('stage_history')
    .select('to_stage, person_id, people:person_id (sales_executive_id)')
    .not('from_stage', 'is', null)
    .gte('changed_at', startISO)
    .lt('changed_at', endISO)
    .returns<FunnelHistoryRow[]>();

  const { data: salesExecutives } = await supabase
    .from('sales_executives')
    .select('id, name')
    .eq('active', true)
    .order('sort_order');
  const nameById = new Map((salesExecutives ?? []).map((p) => [p.id, p.name]));
  const result = aggregateFunnelRows(data ?? [], nameById);

  return { ...result, label };
}

/** Conversion from the previous step, as a whole percent (null for the first). */
export function stepConversion(counts: FunnelCounts, index: number): number | null {
  if (index === 0) return null;
  const prev = counts[FUNNEL_STAGES[index - 1].stage];
  const cur = counts[FUNNEL_STAGES[index].stage];
  if (!prev) return null;
  return Math.round((cur / prev) * 100);
}

export type FollowUpRow = { completed_at: string | null; person_id: string };
export type FollowUpDay = { date: string; label: string; touches: number; clients: number };

/** The Dubai calendar date ('YYYY-MM-DD') an instant falls on. */
export function dubaiDateOf(iso: string): string {
  const d = new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

const dayLabel = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * Follow-ups actioned per day. Deliberately separate from the funnel: the
 * funnel counts people converting, so a client can only be "Spoke to" once and
 * conversion rates stay meaningful. This counts work done, so three calls to
 * the same client is three. Empty days are included so gaps are visible.
 */
export function aggregateFollowUpsByDay(
  rows: FollowUpRow[],
  fromDate: string,
  toDate: string,
): FollowUpDay[] {
  let from = fromDate;
  let to = toDate;
  if (from > to) [from, to] = [to, from];

  const byDate = new Map<string, { touches: number; clients: Set<string> }>();
  for (const row of rows) {
    if (!row.completed_at) continue;
    const date = dubaiDateOf(row.completed_at);
    const bucket = byDate.get(date) ?? { touches: 0, clients: new Set<string>() };
    bucket.touches += 1;
    bucket.clients.add(row.person_id);
    byDate.set(date, bucket);
  }

  const days: FollowUpDay[] = [];
  for (let date = from; date <= to; date = addDaysISO(date, 1)) {
    const bucket = byDate.get(date);
    days.push({
      date,
      label: dayLabel(date),
      touches: bucket?.touches ?? 0,
      clients: bucket?.clients.size ?? 0,
    });
  }
  return days;
}

/** Every client touch completed in the window — notes, WhatsApp taps, follow-ups. */
export async function computeFollowUps(fromDate: string, toDate: string) {
  const supabase = await createServerSupabase();
  const { startISO, endISO } = rangeBounds(fromDate, toDate);

  const { data } = await supabase
    .from('activities')
    .select('completed_at, person_id')
    .eq('status', 'done')
    .not('completed_at', 'is', null)
    .gte('completed_at', startISO)
    .lt('completed_at', endISO)
    .returns<FollowUpRow[]>();

  const days = aggregateFollowUpsByDay(data ?? [], fromDate, toDate);
  return { days, total: days.reduce((n, d) => n + d.touches, 0) };
}
