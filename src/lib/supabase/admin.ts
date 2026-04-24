import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper to safely get environment variables in both Node.js and Cloudflare environments.
 * OpenNext provides getCloudflareContext to access Worker bindings.
 */
function getEnv() {
  // Default to process.env (Node.js/Local)
  let env: Record<string, any> = { ...process.env };

  try {
    // Dynamically attempt to get Cloudflare context
    // This is the standard way for OpenNext to access Worker bindings at runtime
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const cf = getCloudflareContext();
    if (cf && cf.env) {
      env = { ...env, ...cf.env };
    }
  } catch (e) {
    // ignore error if not in Cloudflare context
  }

  return env;
}

/**
 * Supabase admin client — uses the service role key.
 * PROTECTED: This file is marked 'server-only' and will error if imported in client components.
 * 
 * This client bypasses RLS. Use with extreme care.
 */
export function createAdminClient() {
  const env = getEnv();

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  // We only check for presence here so we don't crash during build time
  // (unless a build-time script explicitly calls this)
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
  const env = getEnv();
  return {
    hasUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    envKeys: Object.keys(env).filter(k => k.includes('SUPABASE') || k.includes('SECRET')),
  };
}
