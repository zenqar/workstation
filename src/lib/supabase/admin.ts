import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — uses the service role key.
 * NEVER expose this to the browser. Use only in:
 * - Server Actions
 * - API Route Handlers
 * - Admin panel server code
 *
 * This client bypasses RLS. Use with extreme care.
 */
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
