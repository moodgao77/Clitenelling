import { createServerSupabase } from '@/lib/supabase/server';
import type { Stage } from '@/lib/types';

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export type Period = 'day' | 'week' | 'month';

/** The measurable funnel. "Spoke to" = Contacted; "Answered" = Replied. */
export const FUNNEL_STAGES: { stage: Stage; label: string }[] = [
  { stage: 'contacted', label: 'Spoke to' },
  { stage: 'replied', label: 'Answered' },
  { stage: 'visit_booked', label: 'Booked' },
  { stage: 'visited', label: 'Visited' },
  { stage: 'purchased', label: 'Purchased' },
];

export function periodBounds(period: Period) {
  const d = new Date(Date.now() + DUBAI_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const startOfToday = Date.UTC(y, m, day) - DUBAI_OFFSET_MS;
  const endOfToday = startOfToday + 86_400_000;

  let startUTC: number;
  let endUTC: number;
  let label: string;
  if (period === 'day') {
    startUTC = startOfToday;
    endUTC = endOfToday;
    label = 'Today';
  } else if (period === 'week') {
    startUTC = startOfToday - 6 * 86_400_000;
    endUTC = endOfToday;
    label = 'Last 7 days';
  } else {
    startUTC = Date.UTC(y, m, 1) - DUBAI_OFFSET_MS;
    endUTC = Date.UTC(y, m + 1, 1) - DUBAI_OFFSET_MS;
    label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return {
    startISO: new Date(startUTC).toISOString(),
    endISO: new Date(endUTC).toISOString(),
    label,
  };
}

export type FunnelCounts = Record<string, number>;
export type AssociateFunnel = { id: string; name: string; counts: FunnelCounts };
type HistoryRow = { to_stage: string; person_id: string; people: { owner_id: string | null } | null };

/**
 * Counts, per period, how many distinct clients ENTERED each funnel stage —
 * team-wide and per associate (attributed to the client's owner). Reads the
 * timestamped stage_history ledger, so the funnel can't be gamed.
 */
export async function computeFunnel(period: Period) {
  const supabase = await createServerSupabase();
  const { startISO, endISO, label } = periodBounds(period);

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
    if (!ownerId) continue; // unassigned changes aren't credited to anyone
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
