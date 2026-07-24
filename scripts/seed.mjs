// Seed script — demo associates + Arabic-inclusive dummy dataset.
// Run: npm run seed   (loads .env.local via --env-file)
// Uses the service-role key: bypasses RLS, so it can create users, back-date
// the stage ledger, and write orders. Idempotent: safe to re-run.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'Demo-Pass-2026!';
const STAGES = ['uncontacted', 'contacted', 'visit_booked', 'visited', 'purchased'];
const now = Date.now();
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

// ---------- Associates ----------
const USERS = [
  { email: 'layla@demo.test', full_name: 'Layla Haddad', role: 'associate' },
  { email: 'omar@demo.test', full_name: 'Omar Farouk', role: 'associate' },
  { email: 'fatima@demo.test', full_name: 'Fatima Noor', role: 'associate' },
  { email: 'manager@demo.test', full_name: 'Rania Aziz', role: 'manager' },
];

async function ensureUser({ email, full_name, role }) {
  // Find existing (idempotent) by scanning the first page of users.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
  }
  await db.from('profiles').upsert({ id: user.id, full_name, role });
  return user.id;
}

// ---------- Dummy people ----------
// Mix of Arabic and Latin names; Arabic free-text notes to prove Unicode.
const NAMES = [
  'Aisha Khalid', 'نورة السويدي', 'Mariam Al Blooshi', 'هند المنصوري', 'Sara Rahman',
  'ليلى القاسمي', 'Yasmin Haidar', 'دانة الفلاسي', 'Reem Saleh', 'شيخة النعيمي',
  'Huda Kamal', 'موزة الكعبي', 'Lina Barakat', 'عائشة الظاهري', 'Noor Abbas',
  'مريم الحمادي', 'Salma Idris', 'فاطمة الشامسي', 'Dima Nassar', 'روضة المهيري',
  'Rania Fadel', 'أمل الرميثي', 'Jana Halabi', 'حصة المزروعي', 'Layan Aziz',
  'شمة الكتبي', 'Farah Sultan', 'عفراء النقبي', 'Maya Rustom', 'الجازي العامري',
  'Zeina Tobji', 'ميثاء الشحي', 'Nadia Mansour', 'وفاء البدواوي', 'Tala Hariri',
  'سارة العليلي', 'Rasha Deeb', 'خولة الحوسني', 'Amira Zaki', 'بدرية الرئيسي',
];
const NOTES = [
  'تفضّل العبايات الكلاسيكية، مقاس ٥٢', 'Prefers ivory and champagne tones',
  'يهتم بالإصدارات المحدودة', 'Asked about the new Eid collection',
  'مناسبة زفاف في الشهر القادم', 'VIP — always calls ahead',
  '', 'يفضّل التواصل عبر واتساب مساءً', 'Loves statement sleeves', '',
];
const SOURCES = ['whatsapp', 'instagram', 'walk_in', 'import'];

function phoneFor(i) {
  // Unique valid UAE mobile numbers: +9715 0/2/4/5/6 ...
  const n = (500000000 + i * 137923).toString().slice(0, 9);
  return '+971' + n;
}

async function seedPeople(ownerIds) {
  // Fresh-DB cleanliness: wipe prior seed rows so re-runs stay tidy.
  await db.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('stage_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  let orders = 0;
  let activities = 0;
  const people = [];

  for (let i = 0; i < NAMES.length; i++) {
    // Weighted stage distribution so the funnel looks realistic.
    const roll = i % 10;
    const stageIdx = roll < 2 ? 0 : roll < 5 ? 1 : roll < 7 ? 2 : roll < 9 ? 3 : 4;
    const stage = STAGES[stageIdx];

    // ~1 in 4 unassigned (the prospecting pool); rest round-robin to associates.
    const owner = i % 4 === 0 ? null : ownerIds[i % ownerIds.length];
    const source = stage === 'purchased' ? 'shopify' : SOURCES[i % SOURCES.length];

    const phone = phoneFor(i);
    const { data: person, error } = await db
      .from('people')
      .insert({
        full_name: NAMES[i],
        phone_e164: phone,
        phone_raw: phone,
        source,
        owner_id: owner,
        stage,
        notes: NOTES[i % NOTES.length],
      })
      .select()
      .single();
    if (error) throw new Error(`insert person ${NAMES[i]}: ${error.message}`);
    people.push(person);

    // Replace the trigger's single auto-row with a back-dated journey.
    await db.from('stage_history').delete().eq('person_id', person.id);
    const start = now - (30 + (i % 60)) * DAY; // spread over ~1-3 months
    const rows = [];
    let prev = null;
    for (let s = 0; s <= stageIdx; s++) {
      const at = start + s * 5 * DAY;
      rows.push({
        person_id: person.id,
        from_stage: prev,
        to_stage: STAGES[s],
        changed_by: owner,
        changed_at: iso(at),
      });
      prev = STAGES[s];
    }
    await db.from('stage_history').insert(rows);
    const lastAt = start + stageIdx * 5 * DAY;
    await db.from('people').update({ stage_changed_at: iso(lastAt) }).eq('id', person.id);

    // Orders for purchased people (read-only Shopify mirror shape).
    if (stage === 'purchased') {
      const count = 1 + (i % 3);
      for (let o = 0; o < count; o++) {
        const total = 1200 + ((i * 7 + o * 311) % 40) * 150;
        await db.from('orders').insert({
          person_id: person.id,
          shopify_order_id: `demo-${i}-${o}`,
          order_number: `#${10500 + i * 3 + o}`,
          total,
          currency: 'AED',
          ordered_at: iso(lastAt - o * 20 * DAY),
          line_items: [
            { title: o % 2 ? 'Silk Abaya' : 'Kaftan Gown', qty: 1, price: total },
          ],
        });
        orders++;
      }
      // Post-purchase follow-up due soon (representative; auto-triggers land in Plan 2).
      await db.from('activities').insert({
        person_id: person.id,
        type: 'follow_up',
        title: 'Post-purchase check-in',
        body: 'How is the piece? Offer styling tips.',
        due_at: iso(now + (1 + (i % 3)) * DAY),
        status: 'due',
        trigger_kind: 'post_purchase_48h',
        created_by: owner,
      });
      activities++;
    }

    // A due follow-up for some contacted/interested leads.
    if (stage === 'contacted' || stage === 'visit_booked') {
      await db.from('activities').insert({
        person_id: person.id,
        type: 'follow_up',
        title: 'Follow up on showroom visit',
        body: 'Confirm a date to come in.',
        due_at: iso(now + ((i % 5) - 2) * DAY), // some overdue, some upcoming
        status: 'due',
        trigger_kind: 'interested_lead',
        created_by: owner,
      });
      activities++;
    }

    // A past note activity for texture in the timeline.
    if (i % 3 === 0) {
      await db.from('activities').insert({
        person_id: person.id,
        type: 'note',
        title: 'Call summary',
        body: 'Spoke about upcoming occasion. Interested in new arrivals.',
        status: 'done',
        completed_at: iso(lastAt + DAY),
        created_by: owner,
      });
      activities++;
    }
  }
  return { people: people.length, orders, activities };
}

async function main() {
  console.log('Seeding demo users…');
  const ids = [];
  for (const u of USERS) ids.push(await ensureUser(u));
  const associateIds = ids.slice(0, 3); // exclude manager from ownership

  console.log('Seeding people, stage history, activities, orders…');
  const counts = await seedPeople(associateIds);

  console.log('Done:', {
    users: USERS.length,
    ...counts,
  });
  console.log(`Logins (password ${PASSWORD}):`);
  USERS.forEach((u) => console.log(`  ${u.email}  (${u.role})`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
