insert into sales_executives (id, name, active, sort_order) values
  ('zhang', 'Zhang', true, 30),
  ('other', 'Other', true, 40)
on conflict (id) do update set
  name = excluded.name,
  active = excluded.active,
  sort_order = excluded.sort_order;
