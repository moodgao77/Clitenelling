# Clienteling Prototype — Plan 1: Foundation & Person Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the secure foundation (Next.js + Supabase + login + RLS) and the Person core: phone-identity, Quick-add with dedup/merge, people list, and client profile with timestamped stages and activities.

**Architecture:** Next.js App Router app (mobile-first, Tailwind) backed by cloud Supabase (Postgres + Auth + RLS). All person mutations go through server actions that normalize phones to E.164 (region AE) and merge on conflict. Stage changes always write an append-only `stage_history` row via a Postgres trigger so the funnel cannot be bypassed.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS 4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `libphonenumber-js`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-24-clienteling-prototype-design.md` — read it first. The Deviation Flag (live Shopify store) does NOT apply to this plan; Shopify is Plan 3.

## Global Constraints

- Dummy data only in this plan. No real client records.
- Never hand-roll auth, password storage, or sessions — Supabase Auth only.
- All text columns Unicode (Postgres default) — Arabic must round-trip.
- Phone is identity: unique on `phone_e164`, normalized with default region `AE`.
- Every stage change writes a timestamped `stage_history` row — enforced in the DB, not the UI.
- Appointment / follow-up / note are ONE `activities` table with a `type` column.
- Mobile-first: all screens usable one-handed at 390px width.
- Project root: `C:\Users\Mahmoud Gao\projects\clienteling`. Commit after every task.

---

### Task 1: Scaffold Next.js app

**Files:**
- Create: entire Next.js scaffold at repo root (via `create-next-app`)
- Modify: `.gitignore` (ensure `.env*.local` ignored)

**Interfaces:**
- Produces: runnable dev server at `http://localhost:3000`; TypeScript + Tailwind configured.

- [ ] **Step 1: Scaffold**

Run (PowerShell, in `C:\Users\Mahmoud Gao\projects\clienteling`):
```powershell
npx --yes create-next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm --no-import-alias
```
Expected: scaffold completes; `package.json`, `src/app/` exist. (`create-next-app` tolerates the existing `docs/` + `.git`.)

- [ ] **Step 2: Install runtime deps**

```powershell
npm install @supabase/supabase-js @supabase/ssr libphonenumber-js
npm install -D vitest
```

- [ ] **Step 3: Add test script**

In `package.json` `"scripts"`, add: `"test": "vitest run"`.

- [ ] **Step 4: Verify dev server boots**

```powershell
npm run dev
```
Expected: "Ready" on http://localhost:3000. Stop it after confirming.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "chore: scaffold Next.js + Tailwind + deps"
```

---

### Task 2: Supabase project + environment (USER ACTION REQUIRED)

**Files:**
- Create: `.env.local` (never committed), `.env.example` (committed)

**Interfaces:**
- Produces: env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, for seed script).

- [ ] **Step 1: Walk the user through creating a free Supabase project** (region: closest to Dubai, e.g. `ap-south-1`), then collect the Project URL, anon key, and service-role key from Project Settings → API.

- [ ] **Step 2: Write `.env.local`** with the three values; write `.env.example` with the keys and placeholder values.

- [ ] **Step 3: Verify `.gitignore` covers `.env*.local`** (create-next-app default does).

- [ ] **Step 4: Commit** (`.env.example` only):
```powershell
git add .env.example; git commit -m "chore: add env template for Supabase"
```

---

### Task 3: Database schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tables `profiles`, `people`, `stage_history`, `activities`, `orders`, `shopify_sync_log`; enums `person_stage`, `person_source`, `activity_type`, `activity_status`, `trigger_kind`, `user_role`; trigger `log_stage_change`; RLS on all tables. All later tasks consume these exact names.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 0001_schema.sql
create type user_role as enum ('associate','manager');
create type person_stage as enum ('uncontacted','contacted','visit_booked','visited','purchased');
create type person_source as enum ('whatsapp','instagram','walk_in','shopify','import');
create type activity_type as enum ('appointment','follow_up','note');
create type activity_status as enum ('due','done');
create type trigger_kind as enum ('post_purchase_48h','interested_lead','post_purchase_90d','manual');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'associate',
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text not null unique,
  phone_raw text not null,
  source person_source not null,
  owner_id uuid references profiles(id),
  stage person_stage not null default 'uncontacted',
  stage_changed_at timestamptz not null default now(),
  notes text not null default '',
  shopify_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stage_history (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  from_stage person_stage,
  to_stage person_stage not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  type activity_type not null,
  title text not null,
  body text not null default '',
  due_at timestamptz,
  status activity_status not null default 'due',
  trigger_kind trigger_kind,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  shopify_order_id text not null unique,
  order_number text not null,
  total numeric(12,2) not null,
  currency text not null default 'AED',
  ordered_at timestamptz not null,
  line_items jsonb not null default '[]'
);

create table shopify_sync_log (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  customers_pulled int not null default 0,
  orders_pulled int not null default 0,
  status text not null default 'running',
  error text
);

-- Stage ledger: enforced in DB so the funnel cannot be bypassed.
create or replace function log_stage_change() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into stage_history (person_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.stage, auth.uid());
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    insert into stage_history (person_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_people_stage_insert after insert on people
  for each row execute function log_stage_change();
create trigger trg_people_stage_update before update on people
  for each row execute function log_stage_change();

-- Helpers for RLS
create or replace function my_role() returns user_role
language sql stable security definer as
$$ select role from profiles where id = auth.uid() $$;

-- RLS: associates see owned + unassigned; managers see all.
alter table profiles enable row level security;
alter table people enable row level security;
alter table stage_history enable row level security;
alter table activities enable row level security;
alter table orders enable row level security;
alter table shopify_sync_log enable row level security;

create policy "profiles: read all authenticated" on profiles
  for select to authenticated using (true);

create policy "people: select owned/unassigned/manager" on people
  for select to authenticated
  using (owner_id = auth.uid() or owner_id is null or my_role() = 'manager');
create policy "people: insert authenticated" on people
  for insert to authenticated with check (true);
create policy "people: update owned/unassigned/manager" on people
  for update to authenticated
  using (owner_id = auth.uid() or owner_id is null or my_role() = 'manager');

create policy "stage_history: select via person" on stage_history
  for select to authenticated
  using (exists (select 1 from people p where p.id = person_id
         and (p.owner_id = auth.uid() or p.owner_id is null or my_role() = 'manager')));

create policy "activities: select via person" on activities
  for select to authenticated
  using (exists (select 1 from people p where p.id = person_id
         and (p.owner_id = auth.uid() or p.owner_id is null or my_role() = 'manager')));
create policy "activities: insert via person" on activities
  for insert to authenticated
  with check (exists (select 1 from people p where p.id = person_id
         and (p.owner_id = auth.uid() or p.owner_id is null or my_role() = 'manager')));
create policy "activities: update via person" on activities
  for update to authenticated
  using (exists (select 1 from people p where p.id = person_id
         and (p.owner_id = auth.uid() or p.owner_id is null or my_role() = 'manager')));

create policy "orders: select via person" on orders
  for select to authenticated
  using (exists (select 1 from people p where p.id = person_id
         and (p.owner_id = auth.uid() or p.owner_id is null or my_role() = 'manager')));

create policy "sync_log: manager read" on shopify_sync_log
  for select to authenticated using (my_role() = 'manager');
-- No insert/update/delete policies on stage_history, orders, sync_log:
-- only the trigger (security definer) and service-role jobs write them.
```

- [ ] **Step 2: Apply to the cloud project**

```powershell
npx --yes supabase@latest login   # user pastes access token
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```
Fallback if CLI misbehaves on Windows: paste the SQL into Supabase Dashboard → SQL Editor → Run.
Expected: all statements succeed.

- [ ] **Step 3: Verify** in Dashboard → Table Editor: all six tables exist; RLS shows "enabled" on each.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/0001_schema.sql; git commit -m "feat: schema, stage ledger trigger, RLS policies"
```

---

### Task 4: Phone normalization module (TDD)

**Files:**
- Create: `src/lib/phone.ts`
- Test: `src/lib/phone.test.ts`

**Interfaces:**
- Produces: `normalizePhone(raw: string): { ok: true; e164: string } | { ok: false; error: string }` — used by Quick-add (Task 8), Excel import (Plan 2), Shopify sync (Plan 3).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/phone.test.ts
import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone (region AE)', () => {
  it.each([
    ['+971501234567', '+971501234567'],
    ['0501234567', '+971501234567'],
    ['501234567', '+971501234567'],
    ['05 0123 4567', '+971501234567'],
    ['00971501234567', '+971501234567'],
  ])('resolves %s to one identity %s', (raw, e164) => {
    expect(normalizePhone(raw)).toEqual({ ok: true, e164 });
  });

  it('accepts valid non-UAE numbers', () => {
    expect(normalizePhone('+966501234567')).toEqual({ ok: true, e164: '+966501234567' });
  });

  it.each([['', 'empty'], ['abc', 'invalid'], ['123', 'invalid']])(
    'rejects %s', (raw) => {
      expect(normalizePhone(raw).ok).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm test
```
Expected: FAIL — cannot resolve `./phone`.

- [ ] **Step 3: Implement**

```ts
// src/lib/phone.ts
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

export function normalizePhone(raw: string): PhoneResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Phone is required' };
  const parsed = parsePhoneNumberFromString(trimmed, 'AE');
  if (!parsed || !parsed.isValid()) return { ok: false, error: 'Not a valid phone number' };
  return { ok: true, e164: parsed.number };
}
```

- [ ] **Step 4: Run tests to verify pass** — `npm test` → all green.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/phone.ts src/lib/phone.test.ts; git commit -m "feat: E.164 phone normalization (region AE), TDD"
```

---

### Task 5: Supabase clients + auth (login/logout, protected routes)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`
- Modify: `src/app/layout.tsx` (app shell: bottom nav placeholder, `lang="en"`)

**Interfaces:**
- Produces: `createServerSupabase()` (cookie-aware, for server components/actions), `createBrowserSupabase()`; middleware redirects unauthenticated visitors to `/login`; `signIn(formData)` / `signOut()` server actions. All later UI tasks consume `createServerSupabase()`.

- [ ] **Step 1: Server client** — standard `@supabase/ssr` pattern:

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => all.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
    } },
  );
}
```

- [ ] **Step 2: Browser client**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
export const createBrowserSupabase = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
```

- [ ] **Step 3: Middleware** — refresh session; redirect to `/login` when signed out (except `/login` itself). Use the canonical `@supabase/ssr` middleware recipe with `NextResponse`.

- [ ] **Step 4: Login page + actions** — email+password form (large touch targets); `signIn` calls `supabase.auth.signInWithPassword`, redirects to `/`; `signOut` calls `auth.signOut()`. Show error text on failure. No sign-up page: associates are provisioned by the seed script / dashboard (prevents strangers self-registering into client data — security-relevant).

- [ ] **Step 5: Verify manually** — `npm run dev`; visiting `/` redirects to `/login`; bad password shows error. (Real login verified after Task 6 creates users.)

- [ ] **Step 6: Commit** — `git add -A; git commit -m "feat: Supabase auth, middleware-protected routes, login screen"`

---

### Task 6: Seed script — associates + dummy dataset (Arabic included)

**Files:**
- Create: `scripts/seed.mjs`
- Modify: `package.json` (script `"seed": "node scripts/seed.mjs"`)

**Interfaces:**
- Consumes: `SUPABASE_SERVICE_ROLE_KEY` env (server-only).
- Produces: 4 auth users — `layla@demo.test`, `omar@demo.test`, `fatima@demo.test` (associates), `manager@demo.test` (manager), all password `Demo-Pass-2026!`; ~40 fake people across all stages/sources (several Unassigned; Arabic names + Arabic notes like «تفضل العبايات الكلاسيكية، مقاس ٥٢»), stage history back-dated over ~3 months, activities (due + done), and Shopify-shaped `orders` for purchased people.

- [ ] **Step 1: Write `scripts/seed.mjs`** using `@supabase/supabase-js` with the service-role key: create users via `auth.admin.createUser({ email, password, email_confirm: true })`, insert matching `profiles` rows with roles, then people/activities/orders. Make it idempotent (skip existing emails / phone conflicts). Back-date `stage_history` by updating rows after insert (service role bypasses RLS).

- [ ] **Step 2: Run** — `npm run seed`. Expected output: counts of users/people/activities/orders created.

- [ ] **Step 3: Verify** — Dashboard: `people` has ~40 rows; Arabic text renders correctly (not mojibake); every person has ≥1 `stage_history` row.

- [ ] **Step 4: Verify login** — `npm run dev`, sign in as `layla@demo.test`. Expected: redirected to `/`.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: seed script — demo users + Arabic-inclusive dummy dataset"`

---

### Task 7: People list + search (`/people`) and app shell nav

**Files:**
- Create: `src/app/people/page.tsx`, `src/components/PersonCard.tsx`, `src/components/StageBadge.tsx`, `src/components/BottomNav.tsx`
- Modify: `src/app/layout.tsx` (mount BottomNav)

**Interfaces:**
- Consumes: `createServerSupabase()`.
- Produces: `<StageBadge stage />` and `<PersonCard person />` reused by profile & My Day (Plan 2); bottom nav with tabs My Day `/`, Clients `/people`, Add `/people/new`.

- [ ] **Step 1: Build list page** — server component; fetch people visible under RLS (owned + unassigned; manager sees all), ordered by `updated_at desc`; text search on name/phone via `ilike`; stage filter chips. Each row: name, stage badge, owner ("You" / "Unassigned" / name), last-updated. Tap → `/people/[id]`.

- [ ] **Step 2: Verify RLS visually** — as `layla@demo.test`, confirm Omar-owned seed people do NOT appear; Unassigned do.

- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: people list with search, stage filter, RLS-scoped visibility"`

---

### Task 8: Quick-add with dedup/merge (server action, TDD on merge logic)

**Files:**
- Create: `src/app/people/new/page.tsx`, `src/app/people/actions.ts`, `src/lib/merge.ts`
- Test: `src/lib/merge.test.ts`

**Interfaces:**
- Consumes: `normalizePhone` (Task 4), `createServerSupabase()`.
- Produces: `upsertPersonByPhone(input: { fullName, phoneRaw, source, note? })` server action → `{ created: boolean; personId: string }`; pure `mergePerson(existing, incoming)` used by it and later by import/Shopify (Plans 2–3).

- [ ] **Step 1: Write failing merge tests** — `mergePerson` fills blanks only (name kept if present, notes appended with separator, existing owner kept, source list appended, earliest created_at kept):

```ts
// src/lib/merge.test.ts
import { describe, it, expect } from 'vitest';
import { mergePerson } from './merge';

it('keeps existing owner and name, appends note', () => {
  const merged = mergePerson(
    { full_name: 'Aisha K', owner_id: 'u1', notes: 'likes silk' },
    { full_name: 'Aisha Khalid', owner_id: null, notes: 'size 52' },
  );
  expect(merged.owner_id).toBe('u1');
  expect(merged.full_name).toBe('Aisha K');
  expect(merged.notes).toBe('likes silk\n---\nsize 52');
});

it('fills blank name from incoming', () => {
  expect(mergePerson({ full_name: '', owner_id: null, notes: '' },
    { full_name: 'Noor', owner_id: 'u2', notes: '' }).full_name).toBe('Noor');
});
```

- [ ] **Step 2: Run to fail** — `npm test` → cannot resolve `./merge`.

- [ ] **Step 3: Implement `mergePerson`** (pure function) then the server action: normalize phone → reject invalid with field error → select by `phone_e164` → if exists, update with `mergePerson` result (never create a duplicate); else insert with `owner_id = auth.uid()`, stage `uncontacted`, provided source; optional note becomes an `activities` row (`type: 'note'`). Redirect to `/people/[id]`.

- [ ] **Step 4: Run tests** — `npm test` → green.

- [ ] **Step 5: Build the form** — name, phone (required, `inputmode="tel"`), source segmented control (WhatsApp / Instagram / Walk-in), optional note, one big Save. Thumb-reachable, ≤10s to complete.

- [ ] **Step 6: Manual verify (the identity rule)** — add `+971501112222`, then add `0501112222`: second save must land on the SAME profile (merged), not a duplicate.

- [ ] **Step 7: Commit** — `git add -A; git commit -m "feat: quick-add with phone-identity dedup/merge"`

---

### Task 9: Client profile — the heart (`/people/[id]`)

**Files:**
- Create: `src/app/people/[id]/page.tsx`, `src/app/people/[id]/actions.ts`, `src/components/StageStepper.tsx`, `src/components/ActivityTimeline.tsx`, `src/components/OrderHistory.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: server actions `setStage(personId, stage)`, `assignToMe(personId)`, `addActivity(personId, { type, title, body?, dueAt? })`, `completeActivity(activityId)`, `saveNotes(personId, notes)` — reused by My Day and triggers in Plan 2. WhatsApp helper `waLink(e164, message)` in `src/lib/whatsapp.ts` (strips `+`, URL-encodes message).

- [ ] **Step 1: Build the one-view profile**: header (name, phone, source, owner + "Assign to me" when unassigned), `StageStepper` (one-tap stage change → `setStage`), editable notes (Arabic, `dir="auto"`), `OrderHistory` (read-only, from `orders`), `ActivityTimeline` (merged past + upcoming from `activities` + `stage_history`), add-activity sheet (type / title / optional due date), and a prominent WhatsApp button using `waLink` (plain link for now — auto-log lands in Plan 2 with the triggers, per spec).

- [ ] **Step 2: Manual verify**: change stage → new `stage_history` row with timestamp (check dashboard); Arabic note round-trips; orders render for a seeded purchased person; timeline shows both history and due follow-ups; "Assign to me" flips owner and disappears.

- [ ] **Step 3: Commit** — `git add -A; git commit -m "feat: client profile — stage stepper, timeline, orders, WhatsApp link"`

---

## Definition of done for Plan 1

- `npm test` green (phone + merge suites).
- Log in as associate; add a contact twice under two phone formats → one merged record.
- Stage changes appear in `stage_history` with timestamps, enforced by DB trigger.
- Associate A cannot see associate B's owned people (verified in-app as both users).
- Arabic notes round-trip intact.
- All work committed; app runs with `npm run dev`.

**Next plans:** Plan 2 — WhatsApp auto-log "Contacted", follow-up triggers, My Day, Excel import. Plan 3 — Manager funnel view, deploy to Vercel, gated Shopify sync (Deviation Flag applies).
