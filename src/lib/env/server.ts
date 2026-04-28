import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Global Environment Helper for Cloudflare Workers (OpenNext)
 * This utility ensures that environment variables are correctly read from 
 * Cloudflare Worker bindings at runtime using the async loader.
 */

export async function getServerEnv() {
  try {
    // OpenNext specific: getCloudflareContext provides access to Worker bindings
    // Using async: true is the most reliable way in the latest OpenNext versions
    const cf = await getCloudflareContext({ async: true });
    if (cf && cf.env) {
      return { ...process.env, ...cf.env } as any;
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getServerEnv] getCloudflareContext failed, falling back to process.env');
    }
  }

  // Fallback to process.env for local development
  return process.env as any;
}

export async function getSupabaseUrl() {
  const env = await getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_URL;
}

export async function getSupabaseAnonKey() {
  const env = await getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function getSupabaseServiceRoleKey() {
  const env = await getServerEnv();
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function getAdminSecret() {
  const env = await getServerEnv();
  return env.ADMIN_SECRET;
}

export async function getAppUrl() {
  const env = await getServerEnv();
  return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
