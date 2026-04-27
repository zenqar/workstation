import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/env/server';

/**
 * Supabase Admin client — BYPASSES RLS.
 * USE WITH EXTREME CAUTION. Only for use in Server Actions after manual permission checks.
 */
export async function createAdminClient() {
  const url = await getSupabaseUrl();
  const serviceKey = await getSupabaseServiceRoleKey();
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase Admin configuration');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
