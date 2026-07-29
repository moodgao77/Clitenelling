'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { STAGES, type Stage, type ActivityType } from '@/lib/types';

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

export async function saveNotes(personId: string, notes: string) {
  const { supabase } = await client();
  await supabase.from('people').update({ notes }).eq('id', personId);
  await completeDueFollowUps(supabase, personId);
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
