-- Add the "Replied" funnel stage between Contacted and Visit booked.
-- Captures "the client answered" — a manual one-tap by the associate, since
-- WhatsApp click-to-chat cannot detect a reply automatically.
alter type person_stage add value if not exists 'replied' before 'visit_booked';
