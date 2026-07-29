'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/phone';
import { mergePerson } from '@/lib/merge';
import type { Source } from '@/lib/types';

const SOURCES: Source[] = ['whatsapp', 'instagram', 'walk_in', 'shopify', 'import', 'other'];

export type QuickAddState = { error: string } | undefined;

/**
 * Quick-add. Phone is the identity: normalize, then match on phone_e164.
 * If a record already exists we MERGE (fill blanks, keep owner) rather than
 * create a duplicate. New records are owned by the signed-in associate.
 */
export async function addPerson(
  _prev: QuickAddState,
  formData: FormData,
): Promise<QuickAddState> {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const source = String(formData.get('source') ?? 'walk_in') as Source;
  const sourceDetail = String(formData.get('source_detail') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  if (!phoneRaw) return { error: 'Phone number is required.' };
  const phone = normalizePhone(phoneRaw);
  if (!phone.ok) return { error: phone.error };
  const src: Source = SOURCES.includes(source) ? source : 'walk_in';

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired. Please sign in again.' };

  const { data: existing } = await supabase
    .from('people')
    .select('id, full_name, owner_id, notes')
    .eq('phone_e164', phone.e164)
    .maybeSingle();

  let personId: string;

  if (existing) {
    const merged = mergePerson(
      { full_name: existing.full_name, owner_id: existing.owner_id, notes: existing.notes },
      { full_name: fullName, owner_id: user.id, notes: '' },
    );
    const { error } = await supabase
      .from('people')
      .update({ full_name: merged.full_name, owner_id: merged.owner_id, notes: merged.notes })
      .eq('id', existing.id);
    if (error) return { error: 'Could not save. Please try again.' };
    personId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from('people')
      .insert({
        full_name: fullName,
        phone_e164: phone.e164,
        phone_raw: phoneRaw,
        source: src,
        source_detail: src === 'other' ? sourceDetail : '',
        owner_id: user.id,
        stage: 'uncontacted',
      })
      .select('id')
      .single();
    if (error || !inserted) return { error: 'Could not save. Please try again.' };
    personId = inserted.id;
  }

  // Optional opening note becomes a note activity (one flexible activities model).
  if (note) {
    await supabase.from('activities').insert({
      person_id: personId,
      type: 'note',
      title: 'Note',
      body: note,
      status: 'done',
      completed_at: new Date().toISOString(),
      created_by: user.id,
    });
  }

  redirect(`/people/${personId}`);
}
