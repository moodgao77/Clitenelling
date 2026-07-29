import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/session';
import type { Role } from '@/lib/types';

export type SessionProfile = {
  id: string;
  full_name: string;
  role: Role;
};

/** The signed-in associate's profile, or null. Cached per request. */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  return data ?? null;
});
