import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/session';
import { dubaiDayBounds } from '@/lib/day';

/** Count of the signed-in associate's reminders due by end of today
 *  (overdue included). Powers the bottom-nav badge. RLS scopes it to
 *  the associate's own clients. */
export async function getDueCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  const supabase = await createServerSupabase();

  const { endISO } = dubaiDayBounds();
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'due')
    .not('due_at', 'is', null)
    .lte('due_at', endISO);
  return count ?? 0;
}
