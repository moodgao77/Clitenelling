import { createClient } from '@supabase/supabase-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Scheduled by Vercel Cron (every 15 min). Incremental: SleekFlow returns
// contacts newest-first, so we only process those updated in the last ~30 min
// (overlaps the schedule so nothing is missed). READ-ONLY on SleekFlow.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOOKBACK_MS = 30 * 60 * 1000;

function normalizePhone(raw: string): string | null {
  const p = parsePhoneNumberFromString((raw ?? '').trim(), 'AE');
  return p && p.isValid() ? p.number : null;
}
function sourceFromChannel(channel?: string) {
  const c = (channel ?? '').toLowerCase();
  if (c.includes('insta')) return { source: 'instagram', detail: '' };
  if (c.includes('whatsapp')) return { source: 'whatsapp', detail: '' };
  return { source: 'other', detail: channel ? `SleekFlow: ${channel}` : 'SleekFlow' };
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const HOST = process.env.SLEEKFLOW_HOST;
  const KEY = process.env.SLEEKFLOW_API_KEY;
  if (!HOST || !KEY) return Response.json({ error: 'SleekFlow env missing' }, { status: 500 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailToId = new Map(
    (userList?.users ?? []).map((u) => [(u.email ?? '').toLowerCase(), u.id]),
  );

  const cutoff = Date.now() - LOOKBACK_MS;
  const limit = 100;
  let offset = 0;
  let seen = 0;
  let created = 0;
  let merged = 0;

  outer: for (;;) {
    const res = await fetch(`${HOST}/api/contact?limit=${limit}&offset=${offset}`, {
      headers: { 'X-Sleekflow-Api-Key': KEY, Accept: 'application/json' },
    });
    if (!res.ok) return Response.json({ error: `SleekFlow ${res.status}` }, { status: 502 });
    const contacts = await res.json();
    if (!Array.isArray(contacts) || contacts.length === 0) break;

    for (const c of contacts) {
      const updated = new Date(c.UpdatedAt ?? c.CreatedAt ?? 0).getTime();
      if (updated < cutoff) break outer; // newest-first → everything after is older
      seen++;
      const phone = normalizePhone(c.PhoneNumber ?? '');
      if (!phone) continue;
      const fullName = [c.FirstName, c.LastName].filter(Boolean).join(' ').trim();
      const ownerId = emailToId.get((c.ContactOwnerEmail ?? '').toLowerCase()) ?? null;
      const { source, detail } = sourceFromChannel(c.LastChannel);

      const { data: existing } = await db
        .from('people')
        .select('id, full_name, owner_id')
        .eq('phone_e164', phone)
        .maybeSingle();

      if (existing) {
        const patch: Record<string, unknown> = {};
        if (!existing.full_name && fullName) patch.full_name = fullName;
        if (!existing.owner_id && ownerId) patch.owner_id = ownerId;
        if (Object.keys(patch).length) await db.from('people').update(patch).eq('id', existing.id);
        merged++;
      } else {
        await db.from('people').insert({
          full_name: fullName,
          phone_e164: phone,
          phone_raw: c.PhoneNumber ?? '',
          source,
          source_detail: detail,
          owner_id: ownerId,
          stage: 'uncontacted',
        });
        created++;
      }
    }
    offset += limit;
    if (contacts.length < limit) break;
  }

  return Response.json({ ok: true, seen, created, merged, at: new Date().toISOString() });
}
