import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client — for use in Client Components.
 * Uses the anon key; all queries are subject to RLS.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase browser configuration');
  }

  return createBrowserClient(url, anonKey);
}
