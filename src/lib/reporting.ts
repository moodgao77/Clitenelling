import { createServerSupabase } from '@/lib/supabase/server';
import type { Stage } from '@/lib/types';

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
type HistoryRow = { to_stage: string; person_id: string; people: { owner_id: string | null } | null };

/**
 * Counts, over a date range, how many distinct clients ENTERED each funnel
 * stage — team-wide and per associate (attributed to the client's owner).
 * Reads the timestamped stage_history ledger, so the funnel can't be gamed.
 */
export async function computeFunnel(fromDate: string, toDate: string) {
  const supabase = await createServerSupabase();
  const { startISO, endISO, label } = rangeBounds(fromDate, toDate);

  const { data } = await supabase
    .from('stage_history')
    .select('to_stage, person_id, people:person_id (owner_id)')
    .gte('changed_at', startISO)
    .lt('changed_at', endISO)
    .returns<HistoryRow[]>();

  const team: Record<string, Set<string>> = {};
  const perOwner = new Map<string, Record<string, Set<string>>>();

  for (const row of data ?? []) {
    const stage = row.to_stage;
    (team[stage] ??= new Set()).add(row.person_id);
    const ownerId = row.people?.owner_id;
    if (!ownerId) continue;
    if (!perOwner.has(ownerId)) perOwner.set(ownerId, {});
    const o = perOwner.get(ownerId)!;
    (o[stage] ??= new Set()).add(row.person_id);
  }

  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const toCounts = (rec: Record<string, Set<string>>): FunnelCounts => {
    const c: FunnelCounts = {};
    for (const s of FUNNEL_STAGES) c[s.stage] = rec[s.stage]?.size ?? 0;
    return c;
  };

  const associates: AssociateFunnel[] = [...perOwner.entries()]
    .map(([id]) => ({ id, name: nameById.get(id) ?? 'Unknown', counts: toCounts(perOwner.get(id)!) }))
    .sort((a, b) => b.counts.contacted - a.counts.contacted);

  return { team: toCounts(team), associates, label };
}

/** Conversion from the previous step, as a whole percent (null for the first). */
export function stepConversion(counts: FunnelCounts, index: number): number | null {
  if (index === 0) return null;
  const prev = counts[FUNNEL_STAGES[index - 1].stage];
  const cur = counts[FUNNEL_STAGES[index].stage];
  if (!prev) return null;
  return Math.round((cur / prev) * 100);
}
