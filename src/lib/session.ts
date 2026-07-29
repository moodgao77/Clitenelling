import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Cached per request: validating the session with Supabase Auth is a network
 * round-trip, and a single page render asks for the user several times
 * (layout badge, role, the page itself). `cache()` collapses those into one
 * call per request — a big latency win, especially cross-region.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
