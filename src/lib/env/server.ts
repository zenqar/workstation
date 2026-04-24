import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Global Environment Helper for Cloudflare Workers (OpenNext)
 * This utility ensures that environment variables are correctly read from 
 * Cloudflare Worker bindings at runtime, with a fallback to process.env for local development.
 */

export function getServerEnv() {
  // In many Cloudflare environments, bindings are already on process.env
  let env: Record<string, any> = { ...process.env };

  try {
    // If we are in a context where getCloudflareContext is available, use it to ensure we have all bindings
    const cf = getCloudflareContext();
    if (cf && cf.env) {
      env = { ...env, ...cf.env };
    }
  } catch (e) {
    // ignore
  }

  // Debugging (only in development or if explicitly needed)
  // console.log('[getServerEnv] Keys found:', Object.keys(env).filter(k => k.includes('SUPABASE') || k.includes('SECRET')));

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
