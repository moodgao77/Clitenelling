-- Business attribution for showroom outreach.
-- Sales executives are not auth users: the showroom team may share one login,
-- but each client can still be attributed to Manal, Danila, Other, or Unassigned.
create table if not exists sales_executives (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into sales_executives (id, name, active, sort_order) values
  ('manal', 'Manal', true, 10),
  ('danila', 'Danila', true, 20),
  ('other', 'Other', true, 30)
on conflict (id) do update set
  name = excluded.name,
  active = excluded.active,
  sort_order = excluded.sort_order;

alter table people
  add column if not exists sales_executive_id text references sales_executives(id) on delete set null;

create index if not exists people_sales_executive_idx on people(sales_executive_id);

alter table sales_executives enable row level security;

drop policy if exists "sales_executives: read all authenticated" on sales_executives;
create policy "sales_executives: read all authenticated" on sales_executives
  for select to authenticated using (true);
