import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { SOURCE_LABEL, STAGE_META, type Source, type Stage } from '@/lib/types';

export const dynamic = 'force-dynamic';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: unknown[]) => cells.map(esc).join(',');
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' }) : '';

type Person = {
  id: string;
  full_name: string;
  phone_e164: string;
  source: Source;
  source_detail: string;
  owner_id: string | null;
  stage: Stage;
  created_at: string;
  stage_changed_at: string;
};

export async function GET() {
  const me = await getSessionProfile();
  if (!me || me.role !== 'manager') {
    return new Response('Managers only.', { status: 403 });
  }

  const supabase = await createServerSupabase();
  const [{ data: people }, { data: profiles }, { data: activities }, { data: orders }] =
    await Promise.all([
      supabase
        .from('people')
        .select(
          'id, full_name, phone_e164, source, source_detail, owner_id, stage, created_at, stage_changed_at',
        )
        .order('created_at', { ascending: true })
        .returns<Person[]>(),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('activities').select('person_id, status'),
      supabase.from('orders').select('person_id, total'),
    ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const openTasks = new Map<string, number>();
  const totalActs = new Map<string, number>();
  for (const a of activities ?? []) {
    totalActs.set(a.person_id, (totalActs.get(a.person_id) ?? 0) + 1);
    if (a.status === 'due') openTasks.set(a.person_id, (openTasks.get(a.person_id) ?? 0) + 1);
  }

  const orderCount = new Map<string, number>();
  const orderSum = new Map<string, number>();
  for (const o of orders ?? []) {
    orderCount.set(o.person_id, (orderCount.get(o.person_id) ?? 0) + 1);
    orderSum.set(o.person_id, (orderSum.get(o.person_id) ?? 0) + Number(o.total));
  }

  const header = [
    'Name',
    'Phone',
    'Source',
    'Source detail',
    'Owner',
    'Stage',
    'Open tasks',
    'Total activities',
    'Orders',
    'Lifetime spend (AED)',
    'Added',
    'Last stage change',
  ];

  const lines = [row(header)];
  for (const p of people ?? []) {
    lines.push(
      row([
        p.full_name,
        p.phone_e164,
        SOURCE_LABEL[p.source],
        p.source_detail,
        p.owner_id ? nameById.get(p.owner_id) ?? 'Unknown' : 'Unassigned',
        STAGE_META[p.stage].label,
        openTasks.get(p.id) ?? 0,
        totalActs.get(p.id) ?? 0,
        orderCount.get(p.id) ?? 0,
        (orderSum.get(p.id) ?? 0).toFixed(2),
        day(p.created_at),
        day(p.stage_changed_at),
      ]),
    );
  }

  // BOM so Excel reads UTF-8 (Arabic) correctly.
  const csv = '﻿' + lines.join('\r\n');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="marushika-contacts-${today}.csv"`,
    },
  });
}
