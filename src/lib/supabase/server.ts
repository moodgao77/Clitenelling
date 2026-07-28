import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cookie-aware Supabase client for Server Components, Route Handlers, and
 * Server Actions. Uses the anon key — access is governed by RLS, so this key
 * is powerless without a valid signed-in session.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component where cookies are read-only;
            // the middleware refreshes the session cookie instead.
          }
        },
      },
    },
  );
}
