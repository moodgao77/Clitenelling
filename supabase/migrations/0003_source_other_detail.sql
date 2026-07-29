-- Add an "Other" contact source, plus a free-text detail for it
-- (e.g. "referred by Sara"). The detail is captured at quick-add and
-- included in the manager CSV export.
alter type person_source add value if not exists 'other';
alter table people add column if not exists source_detail text not null default '';
