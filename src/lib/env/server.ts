import 'server-only';

/**
 * Global Environment Helper for Cloudflare Workers (OpenNext)
 * This utility ensures that environment variables are correctly read from 
 * Cloudflare Worker bindings at runtime, with a fallback to process.env for local development.
 */

export function getServerEnv() {
  let env: Record<string, any> = { ...process.env };

  try {
    // OpenNext specific: getCloudflareContext provides access to Worker bindings
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const cf = getCloudflareContext();
    if (cf && cf.env) {
      // Merge Cloudflare bindings into the env object
      // These are variables/secrets set in the Cloudflare Dashboard
      env = { ...env, ...cf.env };
    }
  } catch (e) {
    // Not in a Cloudflare environment or getCloudflareContext failed
    // This is expected during local 'next dev' or some build phases
  }

  return env;
}

export function getSupabaseUrl() {
  const env = getServerEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    // Only throw at runtime when requested
    if (process.env.NODE_ENV === 'production') {
      console.error('[ENV] NEXT_PUBLIC_SUPABASE_URL is missing from runtime!');
    }
  }
  return url;
}

export function getSupabaseAnonKey() {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseServiceRoleKey() {
  const env = getServerEnv();
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getAdminSecret() {
  const env = getServerEnv();
  return env.ADMIN_SECRET;
}

export function getAppUrl() {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
