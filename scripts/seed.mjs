// Seed script — demo associates + Arabic-inclusive dummy dataset.
// Run: npm run seed   (loads .env.local via --env-file)
// Uses the service-role key: bypasses RLS, so it can create users, back-date
// the stage ledger, and write orders. Idempotent: safe to re-run.
//
// Journeys are generated WITHIN the current month with a realistic funnel
// drop-off, so the manager report reads as a coherent funnel for the month.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'Demo-Pass-2026!';
const ORDER = ['uncontacted', 'contacted', 'replied', 'visit_booked', 'visited', 'purchased'];
const DAY = 86_400_000;
const now = Date.now();
const DUBAI = 4 * 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

// Start of the current Dubai calendar month, in UTC ms.
const dNow = new Date(now + DUBAI);
const monthStartUTC = Date.UTC(dNow.getUTCFullYear(), dNow.getUTCMonth(), 1) - DUBAI;

// ---------- Associates ----------
const USERS = [
  { email: 'layla@demo.test', full_name: 'Layla Haddad', role: 'associate' },
  { email: 'omar@demo.test', full_name: 'Omar Farouk', role: 'associate' },
  { email: 'fatima@demo.test', full_name: 'Fatima Noor', role: 'associate' },
  { email: 'manager@demo.test', full_name: 'Rania Aziz', role: 'manager' },
];

const SALES_EXECUTIVES = [
  { id: 'manal', name: 'Manal', active: true, sort_order: 10 },
  { id: 'danila', name: 'Danila', active: true, sort_order: 20 },
  { id: 'zhang', name: 'Zhang', active: true, sort_order: 30 },
  { id: 'other', name: 'Other', active: true, sort_order: 40 },
];

async function ensureUser({ email, full_name, role }) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
  }
  await db.from('profiles').upsert({ id: user.id, full_name, role });
  return user.id;
}

// ---------- Dummy people (Arabic + Latin names, Arabic notes) ----------
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
  const n = (500000000 + i * 137923).toString().slice(0, 9);
  return '+971' + n;
}

// Furthest funnel stage per person → a clean monotonic funnel for the month.
// counts: contacted 30, replied 23, booked 17, visited 11, purchased 6.
function furthestStages() {
  const buckets = [
    ['uncontacted', 10],
    ['contacted', 7],
    ['replied', 6],
    ['visit_booked', 6],
    ['visited', 5],
    ['purchased', 6],
  ];
  const arr = [];
  for (const [stage, n] of buckets) for (let k = 0; k < n; k++) arr.push(ORDER.indexOf(stage));
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function seedPeople(associateIds) {
  await db.from('sales_executives').upsert(SALES_EXECUTIVES);
  await db.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('stage_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const furthest = furthestStages();
  let orders = 0;
  let activities = 0;

  for (let i = 0; i < NAMES.length; i++) {
    const F = furthest[i] ?? 0;
    const stage = ORDER[F];
    const isProspect = F === 0;

    // Uncontacted pool is mostly unassigned (Shopify/import); funnel people are owned.
    const owner = isProspect
      ? i % 3 === 0
        ? associateIds[i % associateIds.length]
        : null
      : associateIds[i % associateIds.length];
    const source = isProspect ? (i % 2 ? 'shopify' : 'import') : SOURCES[i % SOURCES.length];

    const phone = phoneFor(i);
    const { data: person, error } = await db
      .from('people')
      .insert({
        full_name: NAMES[i],
        phone_e164: phone,
        phone_raw: phone,
        source,
        owner_id: owner,
        sales_executive_id: isProspect ? null : SALES_EXECUTIVES[i % SALES_EXECUTIVES.length].id,
        stage,
        notes: NOTES[i % NOTES.length],
      })
      .select()
      .single();
    if (error) throw new Error(`insert person ${NAMES[i]}: ${error.message}`);

    // Replace the trigger's auto row with a within-month journey.
    await db.from('stage_history').delete().eq('person_id', person.id);

    // Journey timing: steps 1–3 days apart; whole journey lands inside the month
    // and before now. Bias some journeys into the last week for the day/week views.
    const stepGaps = [];
    let span = 0;
    for (let k = 1; k <= F; k++) {
      const g = randInt(1, 3) * DAY;
      stepGaps.push(g);
      span += g;
    }
    const earliest = monthStartUTC + DAY;
    const latest = now - 2 * 3600 * 1000 - span;
    const start = latest > earliest ? rand(earliest, latest) : earliest;

    const rows = [];
    let t = start;
    let prev = null;
    for (let k = 0; k <= F; k++) {
      rows.push({
        person_id: person.id,
        from_stage: prev,
        to_stage: ORDER[k],
        changed_by: owner,
        changed_at: iso(t),
      });
      prev = ORDER[k];
      if (k < F) t += stepGaps[k];
    }
    await db.from('stage_history').insert(rows);
    await db.from('people').update({ stage_changed_at: iso(t) }).eq('id', person.id);

    // Orders for purchased clients (read-only Shopify mirror shape).
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
          ordered_at: iso(t - o * 15 * DAY),
          line_items: [{ title: o % 2 ? 'Silk Abaya' : 'Kaftan Gown', qty: 1, price: total }],
        });
        orders++;
      }
      await db.from('activities').insert({
        person_id: person.id,
        type: 'follow_up',
        title: 'Post-purchase check-in',
        body: 'How is the piece? Offer styling tips.',
        due_at: iso(now + (randInt(0, 2) - 1) * DAY), // some overdue, some today/tomorrow
        status: 'due',
        trigger_kind: 'post_purchase_48h',
        created_by: owner,
      });
      activities++;
    }

    // Interested-lead follow-ups for replied / booked clients.
    if (stage === 'replied' || stage === 'visit_booked') {
      await db.from('activities').insert({
        person_id: person.id,
        type: 'follow_up',
        title: 'Follow up on showroom visit',
        body: 'Confirm a date to come in.',
        due_at: iso(now + (randInt(0, 4) - 2) * DAY),
        status: 'due',
        trigger_kind: 'interested_lead',
        created_by: owner,
      });
      activities++;
    }

    // A past note for timeline texture.
    if (i % 3 === 0 && !isProspect) {
      await db.from('activities').insert({
        person_id: person.id,
        type: 'note',
        title: 'Call summary',
        body: 'Spoke about an upcoming occasion. Interested in new arrivals.',
        status: 'done',
        completed_at: iso(t + DAY),
        created_by: owner,
      });
      activities++;
    }
  }
  return { people: NAMES.length, orders, activities };
}

async function main() {
  console.log('Seeding demo users…');
  const ids = [];
  for (const u of USERS) ids.push(await ensureUser(u));
  const associateIds = ids.slice(0, 3);

  console.log('Seeding people, month-shaped funnel history, activities, orders…');
  const counts = await seedPeople(associateIds);

  console.log('Done:', { users: USERS.length, ...counts });
  console.log(`Logins (password ${PASSWORD}):`);
  USERS.forEach((u) => console.log(`  ${u.email}  (${u.role})`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
