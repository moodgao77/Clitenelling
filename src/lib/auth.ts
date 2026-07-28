import { createServerSupabase } from '@/lib/supabase/server';
import type { Role } from '@/lib/types';

export type SessionProfile = {
  id: string;
  full_name: string;
  role: Role;
};

/** The signed-in associate's profile, or null if not authenticated. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  return data ?? null;
}
