import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey, getServerEnv } from '@/lib/env/server';

/**
 * Supabase admin client — uses the service role key.
 * PROTECTED: This file is marked 'server-only' and will error if imported in client components.
 * 
 * This client bypasses RLS. Use with extreme care.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  // We only check for presence here so we don't crash during build time
  if (!url || !key) {
    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    
    throw new Error(
      `[Zenqar Admin] Missing: ${missing.join(', ')}. \n` +
      `Check your Cloudflare Dashboard > Pages > Settings > Variables & Secrets.\n` +
      `IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must be set as a Secret.`
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
export function debugAdminConfig() {
  const env = getServerEnv();
  return {
    hasUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    envKeys: Object.keys(env).filter(k => k.includes('SUPABASE') || k.includes('SECRET')),
  };
}
