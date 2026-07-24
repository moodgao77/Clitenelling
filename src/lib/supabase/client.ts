import { createBrowserClient } from '@supabase/ssr';

/** Browser Supabase client for Client Components. Anon key; RLS-governed. */
export const createBrowserSupabase = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
