-- Closing a lead out. "Not interested" is an exit from the funnel, not a step
-- along it, so it is a flag rather than a seventh person_stage: a client who
-- reached Replied before closing still counts as having reached it, and past
-- funnel numbers do not rewrite themselves when leads are closed.
alter table people add column if not exists closed_at timestamptz;
alter table people add column if not exists closed_reason text not null default '';

-- Closed clients are filtered out of the working lists on every page load.
create index if not exists people_closed_idx on people(closed_at);
