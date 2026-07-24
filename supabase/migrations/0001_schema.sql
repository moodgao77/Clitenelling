-- 0001_schema.sql
-- Clienteling prototype: core schema, stage ledger trigger, and RLS policies.
-- Identity = normalized phone (people.phone_e164 UNIQUE).
-- Every stage change writes an append-only stage_history row via a DB trigger,
-- so the funnel cannot be bypassed by the UI.

-- ---------- Enums ----------
create type user_role as enum ('associate','manager');
create type person_stage as enum ('uncontacted','contacted','visit_booked','visited','purchased');
create type person_source as enum ('whatsapp','instagram','walk_in','shopify','import');
create type activity_type as enum ('appointment','follow_up','note');
create type activity_status as enum ('due','done');
create type trigger_kind as enum ('post_purchase_48h','interested_lead','post_purchase_90d','manual');

-- ---------- Tables ----------
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

-- Helpful indexes for list/search and per-owner queues.
create index people_owner_idx on people(owner_id);
create index people_stage_idx on people(stage);
create index activities_person_idx on activities(person_id);
create index activities_due_idx on activities(due_at) where status = 'due';
create index orders_person_idx on orders(person_id);
create index stage_history_person_idx on stage_history(person_id);

-- ---------- Stage ledger (enforced in DB) ----------
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

-- ---------- RLS helper ----------
create or replace function my_role() returns user_role
language sql stable security definer as
$$ select role from profiles where id = auth.uid() $$;

-- ---------- Row-Level Security ----------
-- Associates see people they own PLUS the Unassigned pool; managers see all.
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

-- Note: stage_history, orders, and shopify_sync_log have NO insert/update/delete
-- policies. They are written only by the security-definer trigger and by
-- service-role jobs (seed / Shopify sync), never directly by associates.
