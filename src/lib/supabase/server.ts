import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env/server';

/**
 * Supabase server client — for use in Server Components and Server Actions.
 * Reads/writes auth cookies automatically. Queries are subject to RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = await getSupabaseUrl();
  const anonKey = await getSupabaseAnonKey();

  return createServerClient(
    url!,
    anonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component; ignored safely.
          }
        },
      },
    }
  );
}
