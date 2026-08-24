export type Stage =
  | 'uncontacted'
  | 'contacted'
  | 'replied'
  | 'visit_booked'
  | 'visited'
  | 'purchased';

export type Source = 'whatsapp' | 'instagram' | 'walk_in' | 'shopify' | 'import' | 'other';
export type ActivityType = 'appointment' | 'follow_up' | 'note';
export type ActivityStatus = 'due' | 'done';
export type Role = 'associate' | 'manager';

// The funnel, in order. Single source of truth for stepper, badges, reporting.
export const STAGES: Stage[] = [
  'uncontacted',
  'contacted',
  'replied',
  'visit_booked',
  'visited',
  'purchased',
];

export const STAGE_META: Record<Stage, { label: string }> = {
  uncontacted: { label: 'Uncontacted' },
  contacted: { label: 'Contacted' },
  replied: { label: 'Replied' },
  visit_booked: { label: 'Visit booked' },
  visited: { label: 'Visited' },
  purchased: { label: 'Purchased' },
};

export const SOURCE_LABEL: Record<Source, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  walk_in: 'Walk-in',
  shopify: 'Shopify',
  import: 'Import',
  other: 'Other',
};

export type SalesExecutive = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type Person = {
  id: string;
  full_name: string;
  phone_e164: string;
  phone_raw: string;
  source: Source;
  source_detail: string;
  owner_id: string | null;
  sales_executive_id: string | null;
  stage: Stage;
  stage_changed_at: string;
  notes: string;
  shopify_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  person_id: string;
  type: ActivityType;
  title: string;
  body: string;
  due_at: string | null;
  status: ActivityStatus;
  trigger_kind: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type Order = {
  id: string;
  person_id: string;
  order_number: string;
  total: number;
  currency: string;
  ordered_at: string;
  line_items: { title: string; qty: number; price: number }[];
};

export type StageHistoryRow = {
  id: string;
  person_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  changed_at: string;
};
