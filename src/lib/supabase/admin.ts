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
    const msg = `Missing Supabase Admin configuration: ${!url ? 'URL ' : ''}${!serviceKey ? 'SERVICE_ROLE_KEY' : ''}`;
    console.error(`[adminClient] ${msg}`);
    throw new Error(msg);
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
