'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { STAGES, type Stage, type ActivityType } from '@/lib/types';
import { CLOSE_OUTCOME } from '@/lib/notes';

async function client() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Working a client (moving their stage, noting an update) IS finishing the
// follow-up. Auto-complete their due/overdue reminders so the associate never
// has to separately hunt for a "Done" button. Future-dated reminders stay.
async function completeDueFollowUps(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  personId: string,
) {
  await supabase
    .from('activities')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('person_id', personId)
    .eq('type', 'follow_up')
    .eq('status', 'due')
    .lte('due_at', new Date().toISOString());
}

function refresh(personId: string) {
  revalidatePath(`/people/${personId}`);
  revalidatePath('/'); // Today queue + nav badge
}

export async function setStage(personId: string, stage: Stage) {
  if (!STAGES.includes(stage)) return;
  const { supabase } = await client();
  // The DB trigger writes the timestamped stage_history row automatically.
  await supabase.from('people').update({ stage }).eq('id', personId);
  await completeDueFollowUps(supabase, personId);
  refresh(personId);
}

export async function assignToMe(personId: string) {
  const { supabase, user } = await client();
  if (!user) return;
  await supabase.from('people').update({ owner_id: user.id }).eq('id', personId);
  refresh(personId);
}

/** Manager-only: assign (or unassign) a client to any team member. */
export async function assignOwner(personId: string, ownerId: string | null) {
  const { supabase } = await client();
  const me = await getSessionProfile();
  if (!me || me.role !== 'manager') return; // managers only
  await supabase
    .from('people')
    .update({ owner_id: ownerId || null })
    .eq('id', personId);
  refresh(personId);
}

export async function assignSalesExecutive(personId: string, salesExecutiveId: string | null) {
  const { supabase, user } = await client();
  if (!user) return;

  const normalizedId = salesExecutiveId || null;
  if (normalizedId) {
    const { data: executive } = await supabase
      .from('sales_executives')
      .select('id')
      .eq('id', normalizedId)
      .eq('active', true)
      .maybeSingle();
    if (!executive) return;
  }

  await supabase
    .from('people')
    .update({ sales_executive_id: normalizedId })
    .eq('id', personId);
  refresh(personId);
}

/** Standing preferences — sizes, colours, occasions. Current state, so it overwrites. */
export async function saveNotes(personId: string, notes: string) {
  const { supabase } = await client();
  await supabase.from('people').update({ notes }).eq('id', personId);
  await completeDueFollowUps(supabase, personId);
  refresh(personId);
}

/** A note proves contact was made. Conditional so it never downgrades a
 *  client already further along the funnel. */
async function advanceFromUncontacted(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  personId: string,
) {
  await supabase
    .from('people')
    .update({ stage: 'contacted' })
    .eq('id', personId)
    .eq('stage', 'uncontacted');
}

/** Close a lead out, and stop it nagging from the Today queue. */
async function markClosed(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  personId: string,
  reason: string,
) {
  const now = new Date().toISOString();
  await supabase
    .from('people')
    .update({ closed_at: now, closed_reason: reason })
    .eq('id', personId);
  // Every pending reminder, not just the overdue ones — a closed lead should
  // not reappear in anyone's queue tomorrow.
  await supabase
    .from('activities')
    .update({ status: 'done', completed_at: now })
    .eq('person_id', personId)
    .eq('status', 'due');
}

/**
 * A dated entry in the client's note log, plus what the conversation led to.
 * Each call appends a new timestamped row, so a note written in October never
 * overwrites September's — and because it lands in `activities`, it shows up in
 * the client's history too.
 *
 * The optional outcome moves the stage in the same submit. Tapping a stage pill
 * is a separate chore that gets forgotten, which is why notes were detailed
 * while the funnel stayed empty; capturing it here catches it while it's fresh.
 */
export async function addNote(personId: string, body: string, outcome?: string) {
  const { supabase, user } = await client();
  if (!user) return; // Server Actions are reachable outside the UI
  const text = body.trim();
  if (!text) return; // never store a blank note

  await supabase.from('activities').insert({
    person_id: personId,
    type: 'note',
    title: 'Note',
    body: text,
    status: 'done',
    completed_at: new Date().toISOString(),
    created_by: user.id,
  });

  if (outcome === CLOSE_OUTCOME) {
    await markClosed(supabase, personId, 'Not interested');
  } else if (outcome && STAGES.includes(outcome as Stage)) {
    // The DB trigger timestamps this into stage_history.
    await supabase.from('people').update({ stage: outcome }).eq('id', personId);
  } else {
    await advanceFromUncontacted(supabase, personId);
  }

  // Writing up a call = working the client → clear their due reminders.
  await completeDueFollowUps(supabase, personId);
  refresh(personId);
}

/** Close a lead out so it stops surfacing in the working lists. */
export async function closeClient(personId: string, reason: string) {
  const { supabase, user } = await client();
  if (!user) return;
  await markClosed(supabase, personId, reason.trim() || 'Not interested');
  refresh(personId);
}

/** Put a closed lead back into play — they got back in touch. */
export async function reopenClient(personId: string) {
  const { supabase, user } = await client();
  if (!user) return;
  await supabase
    .from('people')
    .update({ closed_at: null, closed_reason: '' })
    .eq('id', personId);
  refresh(personId);
}

export async function addActivity(
  personId: string,
  input: { type: ActivityType; title: string; body?: string; dueAt?: string | null },
) {
  const { supabase, user } = await client();
  const isTimed = input.type === 'appointment' || input.type === 'follow_up';
  await supabase.from('activities').insert({
    person_id: personId,
    type: input.type,
    title: input.title || (input.type === 'note' ? 'Note' : 'Follow-up'),
    body: input.body ?? '',
    due_at: isTimed ? input.dueAt ?? null : null,
    status: input.type === 'note' ? 'done' : 'due',
    completed_at: input.type === 'note' ? new Date().toISOString() : null,
    trigger_kind: isTimed ? 'manual' : null,
    created_by: user?.id ?? null,
  });
  // Logging a note = working the client → clear their due reminders.
  // Scheduling a new follow-up/appointment is future work, so it doesn't.
  if (input.type === 'note') await completeDueFollowUps(supabase, personId);
  refresh(personId);
}

/**
 * Fired when the associate taps "Message on WhatsApp". Advances an uncontacted
 * client to Contacted (timestamped by the DB trigger), records the outreach in
 * the timeline, and clears due reminders — so the "spoke to" count is a
 * byproduct of the action, not a separate chore. Does not downgrade a client
 * already further along the funnel.
 */
export async function logWhatsAppContact(personId: string) {
  const { supabase, user } = await client();
  const { data: person } = await supabase
    .from('people')
    .select('stage')
    .eq('id', personId)
    .maybeSingle();
  if (!person) return;

  if (person.stage === 'uncontacted') {
    await supabase.from('people').update({ stage: 'contacted' }).eq('id', personId);
  }
  await supabase.from('activities').insert({
    person_id: personId,
    type: 'note',
    title: 'Messaged on WhatsApp',
    body: '',
    status: 'done',
    completed_at: new Date().toISOString(),
    created_by: user?.id ?? null,
  });
  await completeDueFollowUps(supabase, personId);
  refresh(personId);
}

export async function completeActivity(activityId: string, personId: string) {
  const { supabase } = await client();
  await supabase
    .from('activities')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', activityId);
  refresh(personId);
}

// Form-action wrappers so buttons/forms can call these directly.
export async function setStageAction(formData: FormData) {
  await setStage(String(formData.get('personId')), String(formData.get('stage')) as Stage);
}
export async function assignToMeAction(formData: FormData) {
  await assignToMe(String(formData.get('personId')));
}
export async function saveNotesAction(formData: FormData) {
  await saveNotes(String(formData.get('personId')), String(formData.get('notes') ?? ''));
}
export async function addNoteAction(formData: FormData) {
  await addNote(
    String(formData.get('personId')),
    String(formData.get('note') ?? ''),
    String(formData.get('outcome') ?? ''),
  );
}
export async function closeClientAction(formData: FormData) {
  await closeClient(String(formData.get('personId')), String(formData.get('reason') ?? ''));
}
export async function reopenClientAction(formData: FormData) {
  await reopenClient(String(formData.get('personId')));
}
export async function addActivityAction(formData: FormData) {
  await addActivity(String(formData.get('personId')), {
    type: String(formData.get('type')) as ActivityType,
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    dueAt: (formData.get('dueAt') as string) || null,
  });
}
export async function completeActivityAction(formData: FormData) {
  await completeActivity(String(formData.get('activityId')), String(formData.get('personId')));
}
