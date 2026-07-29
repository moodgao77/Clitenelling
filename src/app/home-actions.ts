'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';

/** Mark a reminder done from the Today screen. */
export async function completeReminder(formData: FormData) {
  const id = String(formData.get('activityId'));
  const supabase = await createServerSupabase();
  await supabase
    .from('activities')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/');
}
