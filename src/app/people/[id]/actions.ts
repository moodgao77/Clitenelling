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

export async function setStage(personId: string, stage: Stage) {
  if (!STAGES.includes(stage)) return;
  const { supabase } = await client();
  // The DB trigger writes the timestamped stage_history row automatically.
  await supabase.from('people').update({ stage }).eq('id', personId);
  revalidatePath(`/people/${personId}`);
}

export async function assignToMe(personId: string) {
  const { supabase, user } = await client();
  if (!user) return;
  await supabase.from('people').update({ owner_id: user.id }).eq('id', personId);
  revalidatePath(`/people/${personId}`);
}

export async function saveNotes(personId: string, notes: string) {
  const { supabase } = await client();
  await supabase.from('people').update({ notes }).eq('id', personId);
  revalidatePath(`/people/${personId}`);
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
  revalidatePath(`/people/${personId}`);
}

export async function completeActivity(activityId: string, personId: string) {
  const { supabase } = await client();
  await supabase
    .from('activities')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', activityId);
  revalidatePath(`/people/${personId}`);
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
