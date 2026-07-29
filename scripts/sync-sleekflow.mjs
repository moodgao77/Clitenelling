// SleekFlow sync — READ-ONLY, one-directional. Pulls contacts FROM SleekFlow
// INTO the tool (GET only; never writes back). SleekFlow is WhatsApp-native,
// so contacts come with phone numbers — the identity for this tool.
//
// Run: npm run sync:sleekflow   (loads .env.local via --env-file)
// Requires: SLEEKFLOW_API_KEY, SLEEKFLOW_HOST  (host is region-specific)
//
// Identity: match/merge on normalized phone. New contacts arrive Uncontacted
// (SleekFlow's own stage doesn't map to our funnel). Owner is auto-assigned
// when the SleekFlow ContactOwnerEmail matches one of our associate logins.

import { createClient } from '@supabase/supabase-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const {
  NEXT_PUBLIC_SUPABASE_URL: SB_URL,
  SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
  SLEEKFLOW_API_KEY: SF_KEY,
  SLEEKFLOW_HOST: HOST,
} = process.env;

if (!SB_URL || !SB_KEY) {
  console.error('Missing Supabase env. Check .env.local.');
  process.exit(1);
}
if (!SF_KEY || !HOST) {
  console.error('Missing SLEEKFLOW_API_KEY or SLEEKFLOW_HOST.');
  process.exit(1);
}

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizePhone(raw) {
  const p = parsePhoneNumberFromString((raw ?? '').trim(), 'AE');
  return p && p.isValid() ? p.number : null;
}

function sourceFromChannel(channel) {
  const c = (channel ?? '').toLowerCase();
  if (c.includes('insta')) return { source: 'instagram', detail: '' };
  if (c.includes('whatsapp')) return { source: 'whatsapp', detail: '' };
  return { source: 'other', detail: channel ? `SleekFlow: ${channel}` : 'SleekFlow' };
}

async function sfGet(path) {
  const res = await fetch(`${HOST}${path}`, {
    headers: { 'X-Sleekflow-Api-Key': SF_KEY, Accept: 'application/json' },
  });
  if (res.status === 429) {
    await sleep(2000);
    return sfGet(path);
  }
  if (!res.ok) throw new Error(`SleekFlow GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`\nSyncing (READ-ONLY) from SleekFlow (${HOST}) …\n`);

  // Map associate/manager email -> profile id, for owner auto-assignment.
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailToId = new Map((userList?.users ?? []).map((u) => [(u.email ?? '').toLowerCase(), u.id]));

  const limit = 200;
  let offset = 0;
  let pulled = 0;
  let created = 0;
  let merged = 0;
  let assigned = 0;
  let skippedNoPhone = 0;

  for (;;) {
    const page = await sfGet(`/api/contact?limit=${limit}&offset=${offset}`);
    const contacts = Array.isArray(page) ? page : page.records ?? page.data ?? [];
    if (contacts.length === 0) break;

    for (const c of contacts) {
      const rawPhone = c.PhoneNumber ?? c.phoneNumber ?? '';
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        skippedNoPhone++;
        continue;
      }
      pulled++;
      const fullName = [c.FirstName, c.LastName].filter(Boolean).join(' ').trim();
      const ownerEmail = (c.ContactOwnerEmail ?? '').toLowerCase();
      const ownerId = emailToId.get(ownerEmail) ?? null;
      const { source, detail } = sourceFromChannel(c.LastChannel);

      const { data: existing } = await db
        .from('people')
        .select('id, full_name, owner_id')
        .eq('phone_e164', phone)
        .maybeSingle();

      if (existing) {
        // Merge: fill a blank name; assign owner only if currently unassigned.
        const patch = {};
        if (!existing.full_name && fullName) patch.full_name = fullName;
        if (!existing.owner_id && ownerId) {
          patch.owner_id = ownerId;
          assigned++;
        }
        if (Object.keys(patch).length) await db.from('people').update(patch).eq('id', existing.id);
        merged++;
      } else {
        const { error } = await db.from('people').insert({
          full_name: fullName,
          phone_e164: phone,
          phone_raw: rawPhone,
          source,
          source_detail: detail,
          owner_id: ownerId,
          stage: 'uncontacted',
        });
        if (error) continue;
        created++;
        if (ownerId) assigned++;
      }
    }

    offset += limit;
    if (contacts.length < limit) break;
    await sleep(300);
  }

  console.log('Done:', { pulled, created, merged, assigned, skippedNoPhone });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
