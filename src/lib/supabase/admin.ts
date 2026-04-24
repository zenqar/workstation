import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey, getServerEnv } from '@/lib/env/server';

/**
 * Supabase admin client — uses the service role key.
 * PROTECTED: This file is marked 'server-only' and will error if imported in client components.
 * 
 * This client bypasses RLS. Use with extreme care.
 */
export async function createAdminClient() {
  const url = await getSupabaseUrl();
  const key = await getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error(
      `[Zenqar Admin] Missing Supabase configuration. \n` +
      `Check your Cloudflare Dashboard > Pages > Settings > Variables & Secrets.\n` +
      `Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.`
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Diagnostic function to check if the admin key is present without exposing it.
 */
export async function debugAdminConfig() {
  const url = await getSupabaseUrl();
  const key = await getSupabaseServiceRoleKey();
  
  return {
    hasUrl: !!url,
    hasServiceKey: !!key,
  };
}
